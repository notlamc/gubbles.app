import "server-only";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { deliveryProvider, type DeliveryChannel } from "@/lib/delivery";
import { env } from "@/lib/env";
import { AUTH } from "@/lib/game/constants";
import { constantTimeEqualHex, deriveKey, encodeFields, hmacHex, randomNumericCode } from "@/lib/security/crypto";

export type ChallengePurpose = "CONFIRM_EMAIL" | "CONFIRM_PHONE" | "CHANGE_EMAIL" | "CHANGE_PHONE" | "PASSWORD_RESET";

let codeKey: Buffer | null = null;
function key() {
  codeKey ??= deriveKey(env().AUTH_HMAC_SECRET, "verification-code/v1");
  return codeKey;
}

function hashCode(userId: string, purpose: string, destination: string, code: string): string {
  return hmacHex(key(), encodeFields(["verification-code", userId, purpose, destination, code]));
}

export function channelFor(purpose: ChallengePurpose): DeliveryChannel {
  return purpose === "CONFIRM_PHONE" || purpose === "CHANGE_PHONE" ? "SMS" : "EMAIL";
}

/**
 * Issue a fresh single-use code and deliver it. Earlier open challenges for the
 * same purpose are superseded. Enforces a resend cooldown.
 */
export async function issueChallenge(input: {
  userId: string;
  purpose: ChallengePurpose;
  destination: string;
  now?: Date;
}): Promise<{ challengeId: string; expiresAt: Date; resendAvailableAt: Date }> {
  const now = input.now ?? new Date();
  const open = await db.verificationChallenge.findFirst({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null, supersededAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (open && now.getTime() - open.lastSentAt.getTime() < AUTH.CODE_RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((open.lastSentAt.getTime() + AUTH.CODE_RESEND_COOLDOWN_MS - now.getTime()) / 1000);
    throw new AppError("RESEND_COOLDOWN", `Hang on — you can request another code in ${retryAfterSeconds}s.`, { retryAfterSeconds });
  }

  const code = randomNumericCode(6);
  const channel = channelFor(input.purpose);
  const expiresAt = new Date(now.getTime() + AUTH.CODE_TTL_MS);
  const challenge = await db.$transaction(async (tx) => {
    await tx.verificationChallenge.updateMany({
      where: { userId: input.userId, purpose: input.purpose, consumedAt: null, supersededAt: null },
      data: { supersededAt: now },
    });
    return tx.verificationChallenge.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        channel,
        destination: input.destination,
        codeHash: hashCode(input.userId, input.purpose, input.destination, code),
        expiresAt,
        maxAttempts: AUTH.CODE_MAX_ATTEMPTS,
        sendCount: (open?.sendCount ?? 0) + 1,
        lastSentAt: now,
      },
    });
  });

  await deliveryProvider().send({ channel, destination: input.destination, purpose: input.purpose, code });
  return {
    challengeId: challenge.id,
    expiresAt,
    resendAvailableAt: new Date(now.getTime() + AUTH.CODE_RESEND_COOLDOWN_MS),
  };
}

/**
 * Verify and consume the current code for a purpose. Attempts are counted before
 * comparison so parallel guesses can't exceed the limit. Returns the destination.
 */
export async function consumeChallenge(input: {
  userId: string;
  purpose: ChallengePurpose;
  code: string;
  now?: Date;
}): Promise<{ destination: string }> {
  const now = input.now ?? new Date();
  const ch = await db.verificationChallenge.findFirst({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null, supersededAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!ch) throw new AppError("INVALID_CODE", "That code isn't right. Request a new one if needed.");
  if (ch.expiresAt.getTime() <= now.getTime()) throw new AppError("CODE_EXPIRED", "That code has expired. Request a fresh one.");

  const counted = await db.verificationChallenge.updateMany({
    where: { id: ch.id, attempts: { lt: ch.maxAttempts }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) throw new AppError("TOO_MANY_ATTEMPTS", "Too many wrong tries. Request a new code.");

  if (!constantTimeEqualHex(ch.codeHash, hashCode(ch.userId, ch.purpose, ch.destination, input.code))) {
    throw new AppError("INVALID_CODE", "That code isn't right. Check it and try again.");
  }
  const consumed = await db.verificationChallenge.updateMany({
    where: { id: ch.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) throw new AppError("INVALID_CODE", "That code has already been used.");
  return { destination: ch.destination };
}

/** Public info about open challenges (never the code). */
export async function openChallenges(userId: string) {
  const rows = await db.verificationChallenge.findMany({
    where: { userId, consumedAt: null, supersededAt: null, expiresAt: { gt: new Date() } },
    select: { purpose: true, destination: true, expiresAt: true, lastSentAt: true },
  });
  return rows.map((r) => ({
    purpose: r.purpose as ChallengePurpose,
    destination: r.destination,
    expiresAt: r.expiresAt,
    resendAvailableAt: new Date(r.lastSentAt.getTime() + AUTH.CODE_RESEND_COOLDOWN_MS),
  }));
}
