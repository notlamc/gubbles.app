import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { db, isUniqueViolation, withTransaction } from "@/lib/db";
import { applyCreditDelta } from "@/lib/credits/ledger";
import { AUTH, GAME, RATE_LIMITS } from "@/lib/game/constants";
import { consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import {
  DisplayNameSchema,
  EmailSchema,
  MfaSchema,
  PasswordSchema,
  PhoneSchema,
  PublicHandleSchema,
  SigninSchema,
  SignupSchema,
  normalizeEmail,
  normalizeUsername,
} from "@/lib/validation";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { issueSession, revokeAllSessions, revokeSession, type IssuedSession, type LiveSession } from "./session";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  formatRecoveryCode,
  hashRecoveryCode,
  matchTotp,
  newRecoveryCode,
  newTotpSecret,
  totpUri,
} from "./totp";
import { consumeChallenge, issueChallenge } from "./verification";

const INVALID_LOGIN = "That email/username and password don't match.";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function signUp(raw: unknown, ctx: { ip: string; deviceHint?: string }): Promise<{ userId: string; session: IssuedSession }> {
  const input = SignupSchema.parse(raw);
  await consumeRateLimit(`signup:ip:${ctx.ip}`, RATE_LIMITS.signupPerIp);

  const username = normalizeUsername(input.username);
  const [byEmail, byUsername, byPhone] = await Promise.all([
    db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    db.user.findFirst({ where: { OR: [{ username }, { publicHandle: username }] }, select: { id: true } }),
    db.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
  ]);
  if (byEmail) throw new AppError("EMAIL_TAKEN", "That email is already registered. Try signing in.");
  if (byUsername) throw new AppError("USERNAME_TAKEN", "That username is taken — try another.");
  if (byPhone) throw new AppError("PHONE_TAKEN", "That phone number is already registered.");

  const passwordHash = await hashPassword(input.password);
  let userId: string;
  try {
    userId = await withTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          username,
          usernameDisplay: input.username,
          phone: input.phone,
          passwordHash,
          termsAcceptedAt: new Date(),
          termsVersion: AUTH.TERMS_VERSION,
          displayName: input.username,
          publicHandle: username,
        },
      });
      await applyCreditDelta(tx, {
        userId: user.id,
        delta: GAME.STARTING_DEMO_CREDIT,
        reason: "SIGNUP_GRANT",
        referenceId: user.id,
      });
      return user.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("EMAIL_TAKEN", "That email, username or phone is already registered.");
    throw err;
  }

  const session = await issueSession(userId, "ACTIVE", ctx.deviceHint);
  // Kick off both confirmations. Failure to deliver shouldn't lose the account.
  await issueChallenge({ userId, purpose: "CONFIRM_EMAIL", destination: input.email }).catch(logDeliveryError);
  await issueChallenge({ userId, purpose: "CONFIRM_PHONE", destination: input.phone }).catch(logDeliveryError);
  return { userId, session };
}

function logDeliveryError(err: unknown) {
  console.warn("[gubbles] code delivery failed:", err instanceof Error ? err.message : "unknown");
}

// ---------------------------------------------------------------------------
// Sign-in and second factor
// ---------------------------------------------------------------------------

export async function signIn(
  raw: unknown,
  ctx: { ip: string; deviceHint?: string },
): Promise<{ session: IssuedSession; mfaRequired: boolean }> {
  const input = SigninSchema.parse(raw);
  const identifier = input.identifier.includes("@") ? normalizeEmail(input.identifier) : normalizeUsername(input.identifier);
  await consumeRateLimit(`login:ip:${ctx.ip}`, RATE_LIMITS.loginPerIp);
  await consumeRateLimit(`login:acct:${identifier}`, RATE_LIMITS.loginPerAccount);

  const user = await db.user.findFirst({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
    include: { totp: true },
  });
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new AppError("INVALID_CREDENTIALS", INVALID_LOGIN);
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw new AppError("INVALID_CREDENTIALS", INVALID_LOGIN);

  await resetRateLimit(`login:acct:${identifier}`);
  const mfaRequired = Boolean(user.totp?.enabledAt);
  const session = await issueSession(user.id, mfaRequired ? "MFA_PENDING" : "ACTIVE", ctx.deviceHint);
  return { session, mfaRequired };
}

/** Verify a TOTP or recovery code for a user. Consumes recovery codes; enforces TOTP replay protection. */
async function verifySecondFactor(userId: string, raw: unknown): Promise<"totp" | "recovery"> {
  const input = MfaSchema.parse(raw);
  const cred = await db.totpCredential.findUnique({ where: { userId } });
  if (!cred?.enabledAt) throw new AppError("TOTP_NOT_ENABLED", "Two-step verification isn't turned on.");

  if ("code" in input) {
    const secret = decryptTotpSecret(userId, cred.secretCipher, cred.keyVersion);
    const step = matchTotp(secret, input.code);
    if (step === null) throw new AppError("INVALID_CODE", "That authenticator code isn't right.");
    // Replay protection: each time step can be used once.
    const used = await db.totpCredential.updateMany({
      where: { id: cred.id, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { lastUsedStep: step },
    });
    if (used.count === 0) throw new AppError("INVALID_CODE", "That code was already used. Wait for the next one.");
    return "totp";
  }

  const hash = hashRecoveryCode(userId, input.recoveryCode);
  const consumed = await db.recoveryCode.updateMany({ where: { userId, codeHash: hash, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count === 0) throw new AppError("INVALID_CODE", "That recovery code isn't valid or was already used.");
  return "recovery";
}

export async function completeMfa(
  pending: LiveSession,
  raw: unknown,
  ctx: { deviceHint?: string },
): Promise<{ session: IssuedSession; method: "totp" | "recovery" }> {
  if (pending.stage !== "MFA_PENDING") throw new AppError("UNAUTHENTICATED", "Sign in first.");
  await consumeRateLimit(`mfa:session:${pending.id}`, RATE_LIMITS.mfaPerSession);
  await consumeRateLimit(`mfa:user:${pending.userId}`, RATE_LIMITS.loginPerAccount);
  const method = await verifySecondFactor(pending.userId, raw);
  // Rotate: the pending session is discarded and a fresh fully-authenticated one issued.
  await revokeSession(pending.id);
  const session = await issueSession(pending.userId, "ACTIVE", ctx.deviceHint);
  return { session, method };
}

// ---------------------------------------------------------------------------
// Contact confirmation (email + phone)
// ---------------------------------------------------------------------------

const ChannelSchema = z.object({ channel: z.enum(["email", "phone"]) });
const ConfirmSchema = z.object({ channel: z.enum(["email", "phone"]), code: z.string() });

export async function sendConfirmation(userId: string, raw: unknown) {
  const { channel } = ChannelSchema.parse(raw);
  await consumeRateLimit(`codes:send:${userId}`, RATE_LIMITS.codeSendPerUser);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (channel === "email") {
    if (user.emailConfirmedAt) return { alreadyConfirmed: true as const };
    return issueChallenge({ userId, purpose: "CONFIRM_EMAIL", destination: user.email });
  }
  if (user.phoneConfirmedAt) return { alreadyConfirmed: true as const };
  return issueChallenge({ userId, purpose: "CONFIRM_PHONE", destination: user.phone });
}

export async function confirmContact(userId: string, raw: unknown) {
  const { channel, code } = ConfirmSchema.parse(raw);
  const parsedCode = z.string().regex(/^\d{6}$/).safeParse(code.replace(/\s/g, ""));
  if (!parsedCode.success) throw new AppError("INVALID_CODE", "Codes are 6 digits.");
  await consumeRateLimit(`codes:verify:${userId}`, RATE_LIMITS.codeVerifyPerUser);
  const purpose = channel === "email" ? "CONFIRM_EMAIL" : "CONFIRM_PHONE";
  const { destination } = await consumeChallenge({ userId, purpose, code: parsedCode.data });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // Only confirm if the code was sent to the address currently on file.
  if (channel === "email" && destination === user.email) {
    await db.user.update({ where: { id: userId }, data: { emailConfirmedAt: new Date() } });
  } else if (channel === "phone" && destination === user.phone) {
    await db.user.update({ where: { id: userId }, data: { phoneConfirmedAt: new Date() } });
  } else {
    throw new AppError("INVALID_CODE", "That code was for an old address. Request a new one.");
  }
  return { confirmed: channel };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function publicAccount(user: {
  id: string;
  email: string;
  usernameDisplay: string;
  phone: string;
  displayName: string;
  publicHandle: string | null;
  ownerIsPublic: boolean;
  emailConfirmedAt: Date | null;
  phoneConfirmedAt: Date | null;
  creditBalance: number;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.usernameDisplay,
    phone: user.phone,
    displayName: user.displayName,
    publicHandle: user.publicHandle,
    ownerIsPublic: user.ownerIsPublic,
    emailConfirmed: Boolean(user.emailConfirmedAt),
    phoneConfirmed: Boolean(user.phoneConfirmedAt),
    demoCredit: user.creditBalance,
    createdAt: user.createdAt.toISOString(),
  };
}

const ProfilePatchSchema = z
  .object({
    displayName: DisplayNameSchema.optional(),
    publicHandle: PublicHandleSchema.optional(),
    ownerIsPublic: z.boolean().optional(),
  })
  .strict();

export async function updateProfile(userId: string, raw: unknown) {
  const patch = ProfilePatchSchema.parse(raw);
  const data: { displayName?: string; publicHandle?: string; ownerIsPublic?: boolean } = {};
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.ownerIsPublic !== undefined) data.ownerIsPublic = patch.ownerIsPublic;
  if (patch.publicHandle !== undefined) {
    const handle = normalizeUsername(patch.publicHandle);
    const clash = await db.user.findFirst({
      where: { NOT: { id: userId }, OR: [{ publicHandle: handle }, { username: handle }] },
      select: { id: true },
    });
    if (clash) throw new AppError("HANDLE_TAKEN", "That handle is taken.");
    data.publicHandle = handle;
  }
  try {
    const user = await db.user.update({ where: { id: userId }, data });
    return publicAccount(user);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("HANDLE_TAKEN", "That handle is taken.");
    throw err;
  }
}

const ContactChangeSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), value: EmailSchema, password: z.string().min(1).max(AUTH.PASSWORD_MAX) }),
  z.object({ channel: z.literal("phone"), value: PhoneSchema, password: z.string().min(1).max(AUTH.PASSWORD_MAX) }),
]);

/** Start changing email/phone. The old value stays active until the new one is confirmed. */
export async function requestContactChange(userId: string, raw: unknown) {
  const input = ContactChangeSchema.parse(raw);
  await consumeRateLimit(`sensitive:${userId}`, RATE_LIMITS.sensitivePerUser);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, input.password))) throw new AppError("INVALID_CREDENTIALS", "Your current password isn't right.");
  if (input.channel === "email") {
    if (input.value === user.email) throw new AppError("VALIDATION_FAILED", "That's already your email.");
    if (await db.user.findUnique({ where: { email: input.value }, select: { id: true } })) {
      throw new AppError("EMAIL_TAKEN", "That email is already registered.");
    }
    return issueChallenge({ userId, purpose: "CHANGE_EMAIL", destination: input.value });
  }
  if (input.value === user.phone) throw new AppError("VALIDATION_FAILED", "That's already your phone number.");
  if (await db.user.findUnique({ where: { phone: input.value }, select: { id: true } })) {
    throw new AppError("PHONE_TAKEN", "That phone number is already registered.");
  }
  return issueChallenge({ userId, purpose: "CHANGE_PHONE", destination: input.value });
}

export async function confirmContactChange(userId: string, raw: unknown) {
  const { channel, code } = ConfirmSchema.parse(raw);
  await consumeRateLimit(`codes:verify:${userId}`, RATE_LIMITS.codeVerifyPerUser);
  const purpose = channel === "email" ? "CHANGE_EMAIL" : "CHANGE_PHONE";
  const { destination } = await consumeChallenge({ userId, purpose, code: code.replace(/\s/g, "") });
  try {
    const user = await db.user.update({
      where: { id: userId },
      data:
        channel === "email"
          ? { email: destination, emailConfirmedAt: new Date() }
          : { phone: destination, phoneConfirmedAt: new Date() },
    });
    return publicAccount(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(channel === "email" ? "EMAIL_TAKEN" : "PHONE_TAKEN", "That address was registered by someone else meanwhile.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Security: password, sessions, TOTP
// ---------------------------------------------------------------------------

const ChangePasswordSchema = z.object({ currentPassword: z.string().min(1).max(AUTH.PASSWORD_MAX), newPassword: PasswordSchema });

/** Change password; revokes every session and returns a fresh one for this device. */
export async function changePassword(session: LiveSession, raw: unknown, ctx: { deviceHint?: string }): Promise<IssuedSession> {
  const input = ChangePasswordSchema.parse(raw);
  await consumeRateLimit(`sensitive:${session.userId}`, RATE_LIMITS.sensitivePerUser);
  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError("INVALID_CREDENTIALS", "Your current password isn't right.");
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await revokeAllSessions(user.id);
  return issueSession(user.id, "ACTIVE", ctx.deviceHint);
}

export async function listSessions(userId: string, currentSessionId: string) {
  const rows = await db.session.findMany({
    where: { userId, revokedAt: null, stage: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    deviceHint: s.deviceHint ?? "Unknown device",
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    current: s.id === currentSessionId,
  }));
}

export async function revokeOwnSession(userId: string, sessionId: string) {
  const r = await db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "That session is already signed out.");
}

const PasswordConfirmSchema = z.object({ password: z.string().min(1).max(AUTH.PASSWORD_MAX) });

async function requirePassword(userId: string, password: string) {
  await consumeRateLimit(`sensitive:${userId}`, RATE_LIMITS.sensitivePerUser);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password))) throw new AppError("INVALID_CREDENTIALS", "Your password isn't right.");
  return user;
}

/** Step 1: password re-entry → pending secret (shown once). */
export async function beginTotpEnrolment(userId: string, raw: unknown) {
  const { password } = PasswordConfirmSchema.parse(raw);
  const user = await requirePassword(userId, password);
  const existing = await db.totpCredential.findUnique({ where: { userId } });
  if (existing?.enabledAt) throw new AppError("TOTP_ALREADY_ENABLED", "Two-step verification is already on.");
  const secret = newTotpSecret();
  const { cipher, keyVersion } = encryptTotpSecret(userId, secret);
  await db.totpCredential.upsert({
    where: { userId },
    create: { userId, secretCipher: cipher, keyVersion },
    update: { secretCipher: cipher, keyVersion, enabledAt: null, lastUsedStep: null },
  });
  const uri = totpUri(secret, user.usernameDisplay);
  const qrSvg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { secret, otpauthUri: uri, qrSvg };
}

async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: AUTH.RECOVERY_CODE_COUNT }, newRecoveryCode);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(userId, c) })) }),
  ]);
  return codes.map(formatRecoveryCode);
}

/** Step 2: verify a code from the app, activate, and return recovery codes (shown once). */
export async function activateTotp(userId: string, raw: unknown) {
  const { code } = z.object({ code: z.string().transform((v) => v.replace(/\s/g, "")) }).parse(raw);
  await consumeRateLimit(`sensitive:${userId}`, RATE_LIMITS.sensitivePerUser);
  const cred = await db.totpCredential.findUnique({ where: { userId } });
  if (!cred) throw new AppError("TOTP_NOT_ENABLED", "Start setup first.");
  if (cred.enabledAt) throw new AppError("TOTP_ALREADY_ENABLED", "Two-step verification is already on.");
  const step = matchTotp(decryptTotpSecret(userId, cred.secretCipher, cred.keyVersion), code);
  if (step === null) throw new AppError("INVALID_CODE", "That code didn't match. Check your app's clock and try again.");
  await db.totpCredential.update({ where: { id: cred.id }, data: { enabledAt: new Date(), lastUsedStep: step } });
  const recoveryCodes = await replaceRecoveryCodes(userId);
  return { enabled: true as const, recoveryCodes };
}

/** Disable with a fresh factor: password + (TOTP or recovery code). */
export async function disableTotp(userId: string, raw: unknown) {
  const input = z
    .object({ password: z.string().min(1).max(AUTH.PASSWORD_MAX), code: z.string().optional(), recoveryCode: z.string().optional() })
    .parse(raw);
  await requirePassword(userId, input.password);
  await verifySecondFactor(userId, input.code ? { code: input.code } : { recoveryCode: input.recoveryCode ?? "" });
  await db.$transaction([db.totpCredential.delete({ where: { userId } }), db.recoveryCode.deleteMany({ where: { userId } })]);
  return { enabled: false as const };
}

export async function regenerateRecoveryCodes(userId: string, raw: unknown) {
  const input = z.object({ password: z.string().min(1).max(AUTH.PASSWORD_MAX), code: z.string() }).parse(raw);
  await requirePassword(userId, input.password);
  await verifySecondFactor(userId, { code: input.code });
  return { recoveryCodes: await replaceRecoveryCodes(userId) };
}

export async function securityOverview(userId: string) {
  const [cred, remaining] = await Promise.all([
    db.totpCredential.findUnique({ where: { userId } }),
    db.recoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return { totpEnabled: Boolean(cred?.enabledAt), recoveryCodesRemaining: cred?.enabledAt ? remaining : 0 };
}

// ---------------------------------------------------------------------------
// Password reset (never reveals whether an account exists)
// ---------------------------------------------------------------------------

export async function requestPasswordReset(raw: unknown, ctx: { ip: string }): Promise<void> {
  const { email } = z.object({ email: EmailSchema }).parse(raw);
  await consumeRateLimit(`reset:ip:${ctx.ip}`, RATE_LIMITS.passwordResetPerIp);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return;
  try {
    await consumeRateLimit(`reset:acct:${user.id}`, RATE_LIMITS.passwordResetPerAccount);
    await issueChallenge({ userId: user.id, purpose: "PASSWORD_RESET", destination: user.email });
  } catch (err) {
    // Cooldown / per-account limits are swallowed so responses are identical either way.
    if (!(err instanceof AppError) || !["RATE_LIMITED", "RESEND_COOLDOWN"].includes(err.code)) throw err;
  }
}

export async function resetPassword(raw: unknown, ctx: { ip: string }): Promise<void> {
  const input = z.object({ email: EmailSchema, code: z.string(), newPassword: PasswordSchema }).parse(raw);
  await consumeRateLimit(`reset:ip:${ctx.ip}`, RATE_LIMITS.passwordResetPerIp);
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError("INVALID_CODE", "That code isn't right or has expired.");
  try {
    await consumeChallenge({ userId: user.id, purpose: "PASSWORD_RESET", code: input.code.replace(/\s/g, "") });
  } catch (err) {
    if (err instanceof AppError) throw new AppError(err.code === "TOO_MANY_ATTEMPTS" ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE", "That code isn't right or has expired.");
    throw err;
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await revokeAllSessions(user.id);
}
