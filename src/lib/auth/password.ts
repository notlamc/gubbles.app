import "server-only";
import { hash, verify, type Options } from "@node-rs/argon2";

// argon2id (Algorithm.Argon2id = 2; const enums can't be imported under isolatedModules).
// OWASP-recommended baseline: m=19 MiB, t=2, p=1.
const OPTIONS: Options = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spend comparable time when the account doesn't exist, to blunt user enumeration by timing. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("gubbles-dummy-password-for-timing");
  await verifyPassword(await dummyHash, password);
}
