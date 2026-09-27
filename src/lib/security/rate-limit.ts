import "server-only";
import { AppError } from "@/lib/api/errors";
import { withTransaction } from "@/lib/db";

/**
 * Fixed-window rate limiter stored in the database so it holds across processes.
 * Throws RATE_LIMITED (with retryAfterSeconds) when the window is exhausted.
 */
export async function consumeRateLimit(key: string, [max, windowMs]: readonly [number, number], now = new Date()): Promise<void> {
  const retryAfterMs = await withTransaction(async (tx) => {
    const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
    if (!bucket || bucket.windowStart.getTime() + windowMs <= now.getTime()) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, windowStart: now, count: 1 },
        update: { windowStart: now, count: 1 },
      });
      return 0;
    }
    if (bucket.count >= max) return bucket.windowStart.getTime() + windowMs - now.getTime();
    await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
    return 0;
  });
  if (retryAfterMs > 0) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    throw new AppError("RATE_LIMITED", "Whoa there — too many tries. Take a breather and try again shortly.", { retryAfterSeconds });
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.rateLimitBucket.deleteMany({ where: { key } });
}
