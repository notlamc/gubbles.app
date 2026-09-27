import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { dailyUsage } from "@/lib/game/daily";
import { utcDay } from "@/lib/game/day";
import { GAME } from "@/lib/game/constants";

export const runtime = "nodejs";

/** Demo credit balance and ledger. Demo credit is non-purchasable and has no monetary value. */
export const GET = route(async () => {
  const s = await requireApiSession();
  const [user, ledger, usage] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: s.userId }, select: { creditBalance: true } }),
    db.creditLedger.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    dailyUsage(db, s.userId, utcDay()),
  ]);
  return json({
    demoCredit: user.creditBalance,
    mintCost: GAME.MINT_COST,
    today: usage,
    ledger: ledger.map((l) => ({ delta: l.delta, balanceAfter: l.balanceAfter, reason: l.reason, createdAt: l.createdAt.toISOString() })),
  });
});
