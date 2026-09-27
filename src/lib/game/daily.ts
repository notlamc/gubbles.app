import "server-only";
import { AppError } from "@/lib/api/errors";
import type { Tx } from "@/lib/db";
import { GAME } from "./constants";

type Counter = "discoveries" | "mints";

const CAPS: Record<Counter, { cap: number; code: "DAILY_DISCOVERY_CAP" | "DAILY_MINT_CAP"; message: string }> = {
  discoveries: {
    cap: GAME.DAILY_DISCOVERY_CAP,
    code: "DAILY_DISCOVERY_CAP",
    message: "You've found all the new Gubbles you can today. Fresh ones appear after midnight UTC!",
  },
  mints: {
    cap: GAME.DAILY_MINT_CAP,
    code: "DAILY_MINT_CAP",
    message: "That's today's mint limit. Your Gubbles will be waiting — come back after midnight UTC.",
  },
};

/** Reserve one unit of a daily allowance inside the caller's transaction (rolled back with it). */
export async function reserveDaily(tx: Tx, userId: string, utcDay: string, counter: Counter): Promise<void> {
  await tx.dailyUsage.upsert({
    where: { userId_utcDay: { userId, utcDay } },
    create: { userId, utcDay },
    update: {},
  });
  const { cap, code, message } = CAPS[counter];
  const r = await tx.dailyUsage.updateMany({
    where: { userId, utcDay, [counter]: { lt: cap } },
    data: { [counter]: { increment: 1 } },
  });
  if (r.count === 0) throw new AppError(code, message, { cap });
}

export async function dailyUsage(tx: Pick<Tx, "dailyUsage">, userId: string, utcDay: string) {
  const row = await tx.dailyUsage.findUnique({ where: { userId_utcDay: { userId, utcDay } } });
  return {
    utcDay,
    discoveries: row?.discoveries ?? 0,
    mints: row?.mints ?? 0,
    discoveryCap: GAME.DAILY_DISCOVERY_CAP,
    mintCap: GAME.DAILY_MINT_CAP,
  };
}
