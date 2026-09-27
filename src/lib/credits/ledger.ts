import "server-only";
import { AppError } from "@/lib/api/errors";
import type { Tx } from "@/lib/db";

export type CreditReason = "SIGNUP_GRANT" | "MINT";

/**
 * Apply a signed delta to a user's demo-credit balance inside a transaction.
 * The guarded update is the first write, which takes the row/database write lock
 * and makes the "never negative" invariant hold under concurrency. The ledger row
 * is append-only and unique per (reason, referenceId), so retries cannot double-apply.
 */
export async function applyCreditDelta(
  tx: Tx,
  input: { userId: string; delta: number; reason: CreditReason; referenceId: string },
): Promise<{ balanceAfter: number }> {
  const { userId, delta } = input;
  if (!Number.isInteger(delta) || delta === 0) throw new Error("delta must be a non-zero integer");
  const updated = await tx.user.updateMany({
    where: { id: userId, ...(delta < 0 ? { creditBalance: { gte: -delta } } : {}) },
    data: { creditBalance: { increment: delta } },
  });
  if (updated.count === 0) {
    throw new AppError("INSUFFICIENT_CREDIT", "Not enough demo credit for that.");
  }
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } });
  await tx.creditLedger.create({
    data: { userId, delta, balanceAfter: user.creditBalance, reason: input.reason, referenceId: input.referenceId },
  });
  return { balanceAfter: user.creditBalance };
}
