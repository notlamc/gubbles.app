import "server-only";
import { AppError } from "@/lib/api/errors";
import { db, isUniqueViolation, withTransaction } from "@/lib/db";
import { GAME, RATE_LIMITS } from "@/lib/game/constants";
import { dailyUsage, reserveDaily } from "@/lib/game/daily";
import { utcDay } from "@/lib/game/day";
import { generateCandidate } from "@/lib/game/generate";
import { checkLocationClaim, describeCell } from "@/lib/game/location";
import { normalizeQrPayload } from "@/lib/game/qr";
import { cardSeed, qrDigest } from "@/lib/game/seed";
import { parseCandidate, serializeCandidate } from "@/lib/game/types";
import { cardFaceFromCandidate, type CardFace } from "@/lib/cards/view";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { extractSingleQrPayload } from "./qr-image";

export interface DiscoveryView {
  id: string;
  utcDay: string;
  approxLocation: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  mintedCardId: string | null;
  /** True when this scan returned an earlier discovery from today. */
  reused: boolean;
  /** True when today's result is pinned to a different location cell than this scan's. */
  locationLocked: boolean;
  card: CardFace;
  mint: { cost: number; balance: number; mintsToday: number; mintCap: number };
}

export async function requireConfirmedPlayer(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.emailConfirmedAt || !user.phoneConfirmedAt) {
    throw new AppError("ACCOUNT_NOT_CONFIRMED", "Confirm your email and phone to start discovering Gubbles.");
  }
  return user;
}

async function toView(
  d: { id: string; utcDay: string; locationCell: string; createdAt: Date; expiresAt: Date; candidate: string; playerId: string },
  opts: { reused: boolean; scanCell?: string; mintedCardId: string | null },
  now: Date,
): Promise<DiscoveryView> {
  const [user, usage] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: d.playerId }, select: { creditBalance: true } }),
    dailyUsage(db, d.playerId, utcDay(now)),
  ]);
  return {
    id: d.id,
    utcDay: d.utcDay,
    approxLocation: describeCell(d.locationCell),
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
    expired: d.expiresAt.getTime() <= now.getTime(),
    mintedCardId: opts.mintedCardId,
    reused: opts.reused,
    locationLocked: Boolean(opts.scanCell && opts.scanCell !== d.locationCell),
    card: cardFaceFromCandidate(parseCandidate(d.candidate)),
    mint: { cost: GAME.MINT_COST, balance: user.creditBalance, mintsToday: usage.mints, mintCap: usage.mintCap },
  };
}

/**
 * Scan → discovery. Deterministic: the same player, QR code and UTC day always
 * yield the same candidate (unique (player, source, day)). A same-day re-scan from
 * a different location returns the ORIGINAL discovery; its location is locked.
 * Only brand-new discoveries count toward the daily discovery cap, so failed or
 * repeated uploads never burn the allowance (they are only rate-limited).
 */
export async function discoverFromImage(input: {
  userId: string;
  image: Uint8Array;
  location: unknown;
  now?: Date;
}): Promise<DiscoveryView> {
  const now = input.now ?? new Date();
  await requireConfirmedPlayer(input.userId);
  await consumeRateLimit(`upload:${input.userId}`, RATE_LIMITS.uploadPerUser, now);

  const loc = checkLocationClaim(input.location, now.getTime());
  if (!loc.ok) throw new AppError(loc.code, loc.message);

  const raw = await extractSingleQrPayload(input.image);
  const normalized = normalizeQrPayload(raw);
  if (!normalized.ok) {
    throw normalized.reason === "TOO_LONG"
      ? new AppError("QR_TOO_LONG", "That QR code holds too much data for Gubbles to read.")
      : new AppError("QR_NOT_FOUND", "That QR code is empty.");
  }
  return discoverFromPayload({ userId: input.userId, digest: qrDigest(normalized.payload), cell: loc.cell, accuracyM: loc.accuracyM, now });
}

/** Core discovery logic from an already-derived digest and location cell. */
export async function discoverFromPayload(input: {
  userId: string;
  digest: string;
  cell: string;
  accuracyM: number;
  now: Date;
}): Promise<DiscoveryView> {
  const { userId, digest, cell, now } = input;
  const day = utcDay(now);

  let source = await db.qrSource.findUnique({ where: { digest } });
  if (!source) {
    try {
      source = await db.qrSource.create({ data: { digest } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      source = await db.qrSource.findUniqueOrThrow({ where: { digest } });
    }
  }
  const sourceId = source.id;
  const key = { playerId_sourceId_utcDay: { playerId: userId, sourceId, utcDay: day } };

  const existing = await db.discovery.findUnique({ where: key, include: { card: { select: { id: true } } } });
  if (existing) return refreshExisting(existing, cell, now);

  try {
    const created = await withTransaction(async (tx) => {
      await reserveDaily(tx, userId, day, "discoveries");
      const seed = cardSeed({ rulesetId: GAME.RULESET_ID, playerId: userId, qrDigest: digest, utcDay: day, locationCell: cell });
      const candidate = generateCandidate({ rulesetId: GAME.RULESET_ID, qrDigest: digest, utcDay: day, locationCell: cell, seed });
      return tx.discovery.create({
        data: {
          playerId: userId,
          sourceId,
          utcDay: day,
          locationCell: cell,
          locationAccuracyM: input.accuracyM,
          rulesetId: GAME.RULESET_ID,
          seed,
          candidate: serializeCandidate(candidate),
          createdAt: now,
          expiresAt: new Date(now.getTime() + GAME.DISCOVERY_PREVIEW_TTL_MS),
        },
      });
    });
    return toView(created, { reused: false, scanCell: cell, mintedCardId: null }, now);
  } catch (err) {
    // A concurrent tab created it first: return that one (same deterministic result).
    if (!isUniqueViolation(err)) throw err;
    const raced = await db.discovery.findUniqueOrThrow({ where: key, include: { card: { select: { id: true } } } });
    return refreshExisting(raced, cell, now);
  }
}

async function refreshExisting(
  d: { id: string; utcDay: string; locationCell: string; createdAt: Date; expiresAt: Date; candidate: string; playerId: string; card: { id: string } | null },
  scanCell: string,
  now: Date,
) {
  let current = d;
  if (!d.card && d.expiresAt.getTime() <= now.getTime()) {
    // Re-open the preview window. The result itself is immutable.
    const expiresAt = new Date(now.getTime() + GAME.DISCOVERY_PREVIEW_TTL_MS);
    await db.discovery.update({ where: { id: d.id }, data: { expiresAt } });
    current = { ...d, expiresAt };
  }
  return toView(current, { reused: true, scanCell, mintedCardId: d.card?.id ?? null }, now);
}

export async function getDiscovery(userId: string, discoveryId: string, now = new Date()): Promise<DiscoveryView> {
  const d = await db.discovery.findUnique({ where: { id: discoveryId }, include: { card: { select: { id: true } } } });
  if (!d || d.playerId !== userId) throw new AppError("NOT_FOUND", "We couldn't find that discovery.");
  return toView(d, { reused: false, mintedCardId: d.card?.id ?? null }, now);
}
