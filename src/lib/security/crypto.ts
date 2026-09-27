import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/** Cryptographically random URL-safe token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(key: Buffer | string, message: string | Buffer): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

export function hmacBytes(key: Buffer | string, message: string | Buffer): Buffer {
  return createHmac("sha256", key).update(message).digest();
}

/** Derive a domain-separated 32-byte subkey from a master secret (HKDF-SHA256). */
export function deriveKey(masterSecret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(masterSecret, "utf8"), Buffer.alloc(0), `gubbles/${purpose}`, 32));
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export { encodeFields } from "@/lib/game/encoding";

/** AES-256-GCM encrypt. Output: base64url(iv).base64url(tag).base64url(ciphertext) */
export function encryptAesGcm(key: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64url")).join(".");
}

export function decryptAesGcm(key: Buffer, payload: string, aad: string): string {
  const [ivS, tagS, dataS] = payload.split(".");
  if (!ivS || !tagS || !dataS) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivS, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagS, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataS, "base64url")), decipher.final()]).toString("utf8");
}

/** Uniform random integer in [0, max) from the CSPRNG. */
export function randomInt(max: number): number {
  return randomBytes(4).readUInt32BE() % max;
}

/** Numeric one-time code, e.g. "042913". */
export function randomNumericCode(digits = 6): string {
  // Rejection sampling to avoid modulo bias.
  const limit = 10 ** digits;
  const ceiling = Math.floor(0x1_0000_0000 / limit) * limit;
  for (;;) {
    const n = randomBytes(4).readUInt32BE();
    if (n < ceiling) return String(n % limit).padStart(digits, "0");
  }
}
