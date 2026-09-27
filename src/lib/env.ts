import "server-only";
import { z } from "zod";

const base64Key = z
  .string()
  .min(1)
  .refine((v) => Buffer.from(v, "base64url").length === 32, "must be 32 bytes, base64url encoded");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.url().transform((v) => new URL(v).origin),
  GAME_HMAC_SECRET: z.string().min(32, "GAME_HMAC_SECRET must be at least 32 characters"),
  AUTH_HMAC_SECRET: z.string().min(32, "AUTH_HMAC_SECRET must be at least 32 characters"),
  TOTP_ENCRYPTION_KEY_V1: base64Key,
  TOTP_KEY_VERSION: z.coerce.number().int().positive().default(1),
  DELIVERY_PROVIDER: z.enum(["console"]).default("console"),
  ARTWORK_PROVIDER: z.enum(["stub", "openai"]).default("stub"),
  ARTWORK_MODEL: z.string().min(1).default("gpt-image-1"),
  ARTWORK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(90_000),
  OPENAI_API_KEY: z.string().optional(),
  ASSET_STORAGE_DIR: z.string().min(1).default("./.data/assets"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Validated server-side environment. Throws a descriptive error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.APP_ORIGIN.startsWith("https://")) {
    throw new Error("APP_ORIGIN must be an https:// origin in production");
  }
  cached = parsed.data;
  return cached;
}

/** Look up a TOTP encryption key by version (TOTP_ENCRYPTION_KEY_V<n>). */
export function totpKey(version: number): Buffer {
  const raw = process.env[`TOTP_ENCRYPTION_KEY_V${version}`];
  if (!raw) throw new Error(`Missing TOTP_ENCRYPTION_KEY_V${version}`);
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) throw new Error(`TOTP_ENCRYPTION_KEY_V${version} must be 32 bytes`);
  return key;
}

/** For tests only. */
export function resetEnvCache() {
  cached = null;
}
