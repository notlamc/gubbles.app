import "server-only";
import * as OTPAuth from "otpauth";
import { env, totpKey } from "@/lib/env";
import { decryptAesGcm, deriveKey, encodeFields, encryptAesGcm, hmacHex } from "@/lib/security/crypto";
import { randomBytes } from "node:crypto";

const PERIOD = 30;

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpUri(secretBase32: string, accountLabel: string): string {
  return new OTPAuth.TOTP({
    issuer: "Gubbles",
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).toString();
}

/**
 * Validate a TOTP code (±1 step). Returns the matched time step, or null.
 * Callers must reject steps <= the last used step (replay protection).
 */
export function matchTotp(secretBase32: string, code: string, now = Date.now()): number | null {
  const delta = OTPAuth.TOTP.validate({
    token: code,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    timestamp: now,
    window: 1,
  });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD) + delta;
}

/** For tests: the current code for a secret. */
export function currentTotp(secretBase32: string, now = Date.now()): string {
  return OTPAuth.TOTP.generate({ secret: OTPAuth.Secret.fromBase32(secretBase32), algorithm: "SHA1", digits: 6, period: PERIOD, timestamp: now });
}

function aad(userId: string, version: number) {
  return `gubbles-totp:${userId}:v${version}`;
}

export function encryptTotpSecret(userId: string, secretBase32: string): { cipher: string; keyVersion: number } {
  const keyVersion = env().TOTP_KEY_VERSION;
  return { cipher: encryptAesGcm(totpKey(keyVersion), secretBase32, aad(userId, keyVersion)), keyVersion };
}

export function decryptTotpSecret(userId: string, cipher: string, keyVersion: number): string {
  return decryptAesGcm(totpKey(keyVersion), cipher, aad(userId, keyVersion));
}

// ---- Recovery codes -------------------------------------------------------

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

export function newRecoveryCode(): string {
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s; // 10 chars; displayed as xxxxx-xxxxx
}

export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

let rcKey: Buffer | null = null;
export function hashRecoveryCode(userId: string, normalizedCode: string): string {
  rcKey ??= deriveKey(env().AUTH_HMAC_SECRET, "recovery-code/v1");
  return hmacHex(rcKey, encodeFields(["recovery-code", userId, normalizedCode]));
}
