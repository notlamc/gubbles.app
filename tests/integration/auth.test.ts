import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  activateTotp,
  beginTotpEnrolment,
  changePassword,
  completeMfa,
  confirmContact,
  confirmContactChange,
  disableTotp,
  listSessions,
  requestContactChange,
  requestPasswordReset,
  resetPassword,
  revokeOwnSession,
  sendConfirmation,
  signIn,
  signUp,
  updateProfile,
} from "@/lib/auth/service";
import { resolveSessionToken, revokeSession } from "@/lib/auth/session";
import { currentTotp } from "@/lib/auth/totp";
import { AUTH, GAME } from "@/lib/game/constants";
import { captureCodes, confirmedPlayer, ledgerSum, newSignup, uniqueSuffix } from "../support/helpers";

let codes: ReturnType<typeof captureCodes>;
beforeEach(() => {
  codes = captureCodes();
});
afterEach(() => {
  codes.restore();
  vi.useRealTimers();
});

const ctx = () => ({ ip: `ip-${uniqueSuffix()}`, deviceHint: "Test on Vitest" });

describe("sign-up and confirmation", () => {
  it("creates a normalized account, grants demo credit once, and sends both codes", async () => {
    const input = newSignup({ email: `  MiXeD_${uniqueSuffix()}@Example.COM `, username: `Cap_${uniqueSuffix()}`.slice(0, 20) });
    const { userId, session } = await signUp(input, ctx());
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe(input.email.trim().toLowerCase());
    expect(user.username).toBe(input.username.toLowerCase());
    expect(user.usernameDisplay).toBe(input.username);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.creditBalance).toBe(GAME.STARTING_DEMO_CREDIT);
    expect(await ledgerSum(userId)).toBe(GAME.STARTING_DEMO_CREDIT);
    expect(await resolveSessionToken(session.token)).toMatchObject({ userId, stage: "ACTIVE" });
    expect(codes.sent.map((c) => c.purpose).sort()).toEqual(["CONFIRM_EMAIL", "CONFIRM_PHONE"]);
    expect(codes.sent.find((c) => c.purpose === "CONFIRM_PHONE")).toMatchObject({ channel: "SMS", destination: input.phone });
    // Codes are stored hashed only.
    const challenges = await db.verificationChallenge.findMany({ where: { userId } });
    for (const ch of challenges) expect(ch.codeHash).not.toContain(codes.last(ch.purpose));
  });

  it("rejects duplicate email / username / phone (case-insensitively) and weak input", async () => {
    const first = newSignup();
    await signUp(first, ctx());
    await expect(signUp({ ...newSignup(), email: first.email.toUpperCase() }, ctx())).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    await expect(signUp({ ...newSignup(), username: first.username.toUpperCase() }, ctx())).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    await expect(signUp({ ...newSignup(), phone: first.phone }, ctx())).rejects.toMatchObject({ code: "PHONE_TAKEN" });
    await expect(signUp({ ...newSignup(), password: "short" }, ctx())).rejects.toThrow(/12 characters/);
    await expect(signUp({ ...newSignup(), password: "x".repeat(AUTH.PASSWORD_MAX + 1) }, ctx())).rejects.toThrow(/at most/);
    await expect(signUp({ ...newSignup(), phone: "07700 900123" }, ctx())).rejects.toThrow(/country code/);
    await expect(signUp({ ...newSignup(), acceptTerms: false }, ctx())).rejects.toThrow(/terms/);
  });

  it("confirms email and phone with separate single-use codes", async () => {
    const { userId } = await signUp(newSignup(), ctx());
    const emailCode = codes.last("CONFIRM_EMAIL");
    const phoneCode = codes.last("CONFIRM_PHONE");
    // The email code does not confirm the phone.
    if (emailCode !== phoneCode) {
      await expect(confirmContact(userId, { channel: "phone", code: emailCode })).rejects.toMatchObject({ code: "INVALID_CODE" });
    }
    await confirmContact(userId, { channel: "email", code: emailCode });
    await expect(confirmContact(userId, { channel: "email", code: emailCode })).rejects.toMatchObject({ code: "INVALID_CODE" });
    await confirmContact(userId, { channel: "phone", code: phoneCode });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailConfirmedAt).not.toBeNull();
    expect(user.phoneConfirmedAt).not.toBeNull();
  });

  it("limits wrong attempts, expires codes and enforces resend cooldown", async () => {
    const { userId } = await signUp(newSignup(), ctx());
    const good = codes.last("CONFIRM_EMAIL");
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < AUTH.CODE_MAX_ATTEMPTS; i++) {
      await expect(confirmContact(userId, { channel: "email", code: wrong })).rejects.toMatchObject({ code: "INVALID_CODE" });
    }
    await expect(confirmContact(userId, { channel: "email", code: good })).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });

    // Resend is blocked during the cooldown …
    await expect(sendConfirmation(userId, { channel: "email" })).rejects.toMatchObject({ code: "RESEND_COOLDOWN" });
    // … and allowed afterwards, superseding the old code.
    await db.verificationChallenge.updateMany({ where: { userId }, data: { lastSentAt: new Date(Date.now() - AUTH.CODE_RESEND_COOLDOWN_MS - 1000) } });
    await sendConfirmation(userId, { channel: "email" });
    const fresh = codes.last("CONFIRM_EMAIL");

    // Expired codes are rejected.
    await db.verificationChallenge.updateMany({ where: { userId, purpose: "CONFIRM_EMAIL", consumedAt: null, supersededAt: null }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(confirmContact(userId, { channel: "email", code: fresh })).rejects.toMatchObject({ code: "CODE_EXPIRED" });
  });

  it("console delivery refuses to run in production", async () => {
    codes.restore();
    const { ConsoleDeliveryProvider } = await import("@/lib/delivery");
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(new ConsoleDeliveryProvider().send({ channel: "EMAIL", destination: "a@b.c", purpose: "X", code: "123456" })).rejects.toMatchObject({ code: "DELIVERY_UNAVAILABLE" });
    } finally {
      vi.unstubAllEnvs();
      codes = captureCodes();
    }
  });
});

describe("sign-in, sessions and password", () => {
  it("signs in by email or username, rotating sessions each time", async () => {
    const { input } = await confirmedPlayer();
    const a = await signIn({ identifier: input.email.toUpperCase(), password: input.password }, ctx());
    const b = await signIn({ identifier: input.username, password: input.password }, ctx());
    expect(a.mfaRequired).toBe(false);
    expect(a.session.token).not.toBe(b.session.token);
    const stored = await db.session.findFirstOrThrow({ where: { id: a.session.sessionId } });
    expect(stored.tokenHash).not.toBe(a.session.token);
  });

  it("uses one generic error for unknown accounts and wrong passwords, and rate-limits", async () => {
    const { input } = await confirmedPlayer();
    const c = ctx();
    const e1 = await signIn({ identifier: input.email, password: "wrong password!!" }, c).catch((e) => e);
    const e2 = await signIn({ identifier: `nobody_${uniqueSuffix()}@example.com`, password: "whatever12345" }, c).catch((e) => e);
    expect(e1).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(e2).toMatchObject({ code: "INVALID_CREDENTIALS", message: e1.message });
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      const e = await signIn({ identifier: input.email, password: "wrong password!!" }, ctx()).catch((err) => err);
      if (e.code === "RATE_LIMITED") limited = true;
    }
    expect(limited).toBe(true);
  });

  it("expired and revoked sessions are rejected", async () => {
    const { session, userId } = await confirmedPlayer();
    expect(await resolveSessionToken(session.token)).not.toBeNull();
    await db.session.update({ where: { id: session.sessionId }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await resolveSessionToken(session.token)).toBeNull();

    const { input } = await confirmedPlayer();
    const s = await signIn({ identifier: input.email, password: input.password }, ctx());
    await revokeSession(s.session.sessionId);
    expect(await resolveSessionToken(s.session.token)).toBeNull();
    expect(await resolveSessionToken("not-a-real-token")).toBeNull();
    expect(userId).toBeTruthy();
  });

  it("lists and revokes own sessions only", async () => {
    const p1 = await confirmedPlayer();
    const p2 = await confirmedPlayer();
    const second = await signIn({ identifier: p1.input.email, password: p1.input.password }, ctx());
    const list = await listSessions(p1.userId, p1.session.sessionId);
    expect(list.length).toBe(2);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    await expect(revokeOwnSession(p2.userId, second.session.sessionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await revokeOwnSession(p1.userId, second.session.sessionId);
    expect(await resolveSessionToken(second.session.token)).toBeNull();
  });

  it("change password requires the current password and revokes all sessions", async () => {
    const { input, userId, session } = await confirmedPlayer();
    const other = await signIn({ identifier: input.email, password: input.password }, ctx());
    const live = (await resolveSessionToken(session.token))!;
    await expect(changePassword(live, { currentPassword: "not my password", newPassword: "brand new password 1" }, {})).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const fresh = await changePassword(live, { currentPassword: input.password, newPassword: "brand new password 1" }, {});
    expect(await resolveSessionToken(session.token)).toBeNull();
    expect(await resolveSessionToken(other.session.token)).toBeNull();
    expect(await resolveSessionToken(fresh.token)).toMatchObject({ userId });
    await expect(signIn({ identifier: input.email, password: input.password }, ctx())).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(signIn({ identifier: input.email, password: "brand new password 1" }, ctx())).resolves.toBeTruthy();
  });

  it("password reset never reveals whether an account exists and revokes sessions", async () => {
    const { input, session } = await confirmedPlayer();
    await expect(requestPasswordReset({ email: `ghost_${uniqueSuffix()}@example.com` }, ctx())).resolves.toBeUndefined();
    await expect(requestPasswordReset({ email: input.email }, ctx())).resolves.toBeUndefined();
    // Repeat requests (cooldown) still look identical.
    await expect(requestPasswordReset({ email: input.email }, ctx())).resolves.toBeUndefined();
    const code = codes.last("PASSWORD_RESET");
    await expect(resetPassword({ email: `ghost_${uniqueSuffix()}@example.com`, code, newPassword: "reset password 123" }, ctx())).rejects.toMatchObject({ code: "INVALID_CODE" });
    await resetPassword({ email: input.email, code, newPassword: "reset password 123" }, ctx());
    expect(await resolveSessionToken(session.token)).toBeNull();
    await expect(signIn({ identifier: input.email, password: "reset password 123" }, ctx())).resolves.toBeTruthy();
  });
});

describe("profile and contact changes", () => {
  it("updates display name and public handle, rejecting clashes", async () => {
    const a = await confirmedPlayer();
    const b = await confirmedPlayer();
    const r = await updateProfile(a.userId, { displayName: "  Bubble   Boss ", publicHandle: `Boss_${uniqueSuffix()}`.slice(0, 20), ownerIsPublic: false });
    expect(r.displayName).toBe("Bubble Boss");
    expect(r.ownerIsPublic).toBe(false);
    await expect(updateProfile(b.userId, { publicHandle: a.input.username })).rejects.toMatchObject({ code: "HANDLE_TAKEN" });
    await expect(updateProfile(b.userId, { displayName: "<script>" })).rejects.toThrow();
    await expect(updateProfile(b.userId, { email: "x@y.z" })).rejects.toThrow();
  });

  it("changing email requires the password and reconfirmation; old email stays until confirmed", async () => {
    const { userId, input } = await confirmedPlayer();
    const newEmail = `new_${uniqueSuffix()}@example.com`;
    await expect(requestContactChange(userId, { channel: "email", value: newEmail, password: "nope nope nope" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await requestContactChange(userId, { channel: "email", value: newEmail, password: input.password });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(input.email);
    const r = await confirmContactChange(userId, { channel: "email", code: codes.last("CHANGE_EMAIL") });
    expect(r.email).toBe(newEmail);
    expect(r.emailConfirmed).toBe(true);
  });
});

describe("TOTP two-step verification", () => {
  it("enrols with password, activates with a code, requires a factor at sign-in, and supports recovery codes", async () => {
    const { userId, input } = await confirmedPlayer();
    await expect(beginTotpEnrolment(userId, { password: "wrong password" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const setup = await beginTotpEnrolment(userId, { password: input.password });
    expect(setup.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.qrSvg).toContain("<svg");
    const cred = await db.totpCredential.findUniqueOrThrow({ where: { userId } });
    expect(cred.secretCipher).not.toContain(setup.secret);
    expect(cred.enabledAt).toBeNull();

    // Not required until activated.
    expect((await signIn({ identifier: input.email, password: input.password }, ctx())).mfaRequired).toBe(false);

    await expect(activateTotp(userId, { code: "000000" === currentTotp(setup.secret) ? "111111" : "000000" })).rejects.toMatchObject({ code: "INVALID_CODE" });
    const { recoveryCodes } = await activateTotp(userId, { code: currentTotp(setup.secret) });
    expect(recoveryCodes).toHaveLength(AUTH.RECOVERY_CODE_COUNT);
    const stored = await db.recoveryCode.findMany({ where: { userId } });
    for (const rc of recoveryCodes) expect(stored.some((s) => s.codeHash.includes(rc.replace("-", "")))).toBe(false);

    // Sign-in now needs a second factor; the pending session can't be used as a full session.
    const pending = await signIn({ identifier: input.email, password: input.password }, ctx());
    expect(pending.mfaRequired).toBe(true);
    const pendingLive = (await resolveSessionToken(pending.session.token))!;
    expect(pendingLive.stage).toBe("MFA_PENDING");

    // The code used at activation can't be replayed.
    await expect(completeMfa(pendingLive, { code: currentTotp(setup.secret) }, {})).rejects.toMatchObject({ code: "INVALID_CODE" });

    // A recovery code works once.
    const done = await completeMfa(pendingLive, { recoveryCode: recoveryCodes[0]!.toUpperCase() }, {});
    expect(done.method).toBe("recovery");
    expect(await resolveSessionToken(pending.session.token)).toBeNull(); // rotated
    expect(await resolveSessionToken(done.session.token)).toMatchObject({ stage: "ACTIVE" });

    const again = await signIn({ identifier: input.email, password: input.password }, ctx());
    const againLive = (await resolveSessionToken(again.session.token))!;
    await expect(completeMfa(againLive, { recoveryCode: recoveryCodes[0]! }, {})).rejects.toMatchObject({ code: "INVALID_CODE" });

    // A TOTP code from the next time step works.
    const next = currentTotp(setup.secret, Date.now() + 30_000);
    await expect(completeMfa(againLive, { code: next }, {})).resolves.toMatchObject({ method: "totp" });

    // Disabling needs password + a fresh factor.
    await expect(disableTotp(userId, { password: input.password, code: "123456" })).rejects.toBeTruthy();
    await disableTotp(userId, { password: input.password, recoveryCode: recoveryCodes[1]! });
    expect(await db.totpCredential.findUnique({ where: { userId } })).toBeNull();
    expect(await db.recoveryCode.count({ where: { userId } })).toBe(0);
    expect((await signIn({ identifier: input.email, password: input.password }, ctx())).mfaRequired).toBe(false);
  });

  it("rate-limits second-factor attempts per pending session", async () => {
    const { userId, input } = await confirmedPlayer();
    const setup = await beginTotpEnrolment(userId, { password: input.password });
    await activateTotp(userId, { code: currentTotp(setup.secret) });
    const pending = await signIn({ identifier: input.email, password: input.password }, ctx());
    const live = (await resolveSessionToken(pending.session.token))!;
    const results: string[] = [];
    for (let i = 0; i < 8; i++) results.push((await completeMfa(live, { code: "000001" }, {}).catch((e) => e)).code);
    expect(results).toContain("RATE_LIMITED");
  });
});
