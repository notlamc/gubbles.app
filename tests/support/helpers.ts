import { readFileSync } from "node:fs";
import path from "node:path";
import type { CodeMessage } from "@/lib/delivery";
import { db } from "@/lib/db";
import { signUp, confirmContact } from "@/lib/auth/service";

/** View of codes "delivered" by the console provider since this call (see setup.ts). */
export function captureCodes() {
  const all = (globalThis as { __SENT_CODES__?: CodeMessage[] }).__SENT_CODES__!;
  const start = all.length;
  const view = {
    get sent() {
      return all.slice(start);
    },
    last(purpose: string) {
      const m = [...all.slice(start)].reverse().find((x) => x.purpose === purpose);
      if (!m) throw new Error(`no code sent for ${purpose}`);
      return m.code;
    },
    restore: () => undefined,
  };
  return view;
}

let counter = 0;
export function uniqueSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function newSignup(overrides: Partial<{ email: string; username: string; phone: string; password: string }> = {}) {
  const s = uniqueSuffix();
  return {
    email: `player_${s}@example.com`,
    username: `p_${s}`.slice(0, 20),
    phone: `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
    password: "correct horse battery staple",
    acceptTerms: true as const,
    ...overrides,
  };
}

/** Create a user with confirmed email + phone. */
export async function confirmedPlayer(overrides: Parameters<typeof newSignup>[0] = {}) {
  const codes = captureCodes();
  try {
    const input = newSignup(overrides);
    const { userId, session } = await signUp(input, { ip: `ip-${uniqueSuffix()}` });
    await confirmContact(userId, { channel: "email", code: codes.last("CONFIRM_EMAIL") });
    await confirmContact(userId, { channel: "phone", code: codes.last("CONFIRM_PHONE") });
    return { userId, session, input };
  } finally {
    codes.restore();
  }
}

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../fixtures", name)));
}

export function freshLocation(now = Date.now(), lat = 51.5074, lon = -0.1278) {
  return { latitude: lat, longitude: lon, accuracy: 35, timestamp: now - 1000 };
}

export async function ledgerSum(userId: string) {
  const agg = await db.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}
