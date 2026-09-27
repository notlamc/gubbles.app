import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;

/** True when a Prisma error is a unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Run an interactive transaction, retrying a few times on write conflicts
 * (SQLITE_BUSY / MySQL deadlocks surface as P2034 or timeouts).
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await db.$transaction(fn, { maxWait: 5_000, timeout: 10_000 });
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.code === "P1008");
      const busy = err instanceof Error && /database is locked|SQLITE_BUSY/i.test(err.message);
      if (!retryable && !busy) throw err;
      await new Promise((r) => setTimeout(r, 20 * (i + 1) + Math.floor(Math.random() * 20)));
    }
  }
  throw lastErr;
}
