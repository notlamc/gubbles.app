import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { db, isUniqueViolation, withTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueueArtworkJob } from "@/lib/artwork/jobs";
import { applyCreditDelta } from "@/lib/credits/ledger";
import { ELEMENT_IDS, FAMILY_IDS, RARITY_IDS } from "@/lib/game/catalogue";
import { GAME, RATE_LIMITS } from "@/lib/game/constants";
import { reserveDaily } from "@/lib/game/daily";
import { utcDay } from "@/lib/game/day";
import { describeCell } from "@/lib/game/location";
import { parseArtSpec, parseCandidate } from "@/lib/game/types";
import { randomToken } from "@/lib/security/crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { cardFaceFromCandidate, type ArtStatus, type MintedCardView } from "./view";
import type { Card, CardTrait } from "@prisma/client";

type CardRow = Card & { traits: CardTrait[] };

export function verificationUrl(publicId: string): string {
  return `${env().APP_ORIGIN}/verify/cards/${publicId}`;
}

export function toCardView(card: CardRow): MintedCardView {
  const traits = [...card.traits].sort((a, b) => a.slot - b.slot).map((t) => t.traitId) as [string, string];
  const face = cardFaceFromCandidate({
    v: 1,
    rulesetId: card.rulesetId,
    name: card.name,
    family: card.family as never,
    element: card.element as never,
    role: card.role as never,
    rarity: card.rarity as never,
    variant: card.variant as never,
    stats: { power: card.power, guard: card.guard, speed: card.speed },
    traits,
    flavour: card.flavour,
    signature: card.signature,
    artSpec: parseArtSpec(card.artSpec),
  });
  const ready = card.artStatus === "ART_READY" && card.artAssetKey;
  return {
    ...face,
    id: card.id,
    cardNumber: `${face.family.code}-${String(face.family.number).padStart(3, "0")}·${card.publicVerificationId.slice(0, 6).toUpperCase()}`,
    mintedAt: card.mintedAt.toISOString(),
    art: {
      status: card.artStatus as ArtStatus,
      url: ready ? `/api/v1/art/${card.id}/display` : null,
      thumbUrl: ready ? `/api/v1/art/${card.id}/thumb` : null,
      provider: card.artProvider,
      model: card.artModel,
      isStub: card.artProvider === "local-stub",
      generatedAt: card.artGeneratedAt?.toISOString() ?? null,
    },
    verification: { publicId: card.publicVerificationId, url: verificationUrl(card.publicVerificationId) },
  };
}

// ---------------------------------------------------------------------------
// Minting
// ---------------------------------------------------------------------------

/**
 * Mint the exact candidate stored on a discovery. Accepts only a discovery id —
 * never client-supplied stats/art/location. One transaction verifies owner,
 * expiry, daily cap and credit; debits once; creates exactly one ART_PENDING card
 * and queues its artwork job. Idempotent: retries return the existing card.
 */
export async function mintDiscovery(input: { userId: string; discoveryId: string; now?: Date }): Promise<{ card: MintedCardView; alreadyMinted: boolean }> {
  const now = input.now ?? new Date();
  await consumeRateLimit(`mint:${input.userId}`, RATE_LIMITS.mintPerUser, now);

  const existingCard = await findMintedCard(input.userId, input.discoveryId);
  if (existingCard) return { card: existingCard, alreadyMinted: true };

  try {
    const cardId = await withTransaction(async (tx) => {
      const d = await tx.discovery.findUnique({ where: { id: input.discoveryId }, include: { card: { select: { id: true } }, source: true } });
      if (!d || d.playerId !== input.userId) throw new AppError("NOT_FOUND", "We couldn't find that discovery.");
      if (d.card) return d.card.id;
      if (d.expiresAt.getTime() <= now.getTime()) {
        throw new AppError("DISCOVERY_EXPIRED", "This preview has expired. Scan the code again to reopen it — it'll be the same Gubble today.");
      }
      // Debit first: it's the first write, so it takes the write lock (see ledger.ts).
      await applyCreditDelta(tx, { userId: input.userId, delta: -GAME.MINT_COST, reason: "MINT", referenceId: d.id });
      await reserveDaily(tx, input.userId, utcDay(now), "mints");

      const c = parseCandidate(d.candidate);
      const card = await tx.card.create({
        data: {
          publicVerificationId: randomToken(18),
          discoveryId: d.id,
          ownerId: input.userId,
          minterId: input.userId,
          mintedAt: now,
          mintedUtcDay: utcDay(now),
          rulesetId: d.rulesetId,
          seed: d.seed,
          qrDigest: d.source.digest,
          locationCell: d.locationCell,
          discoveryUtcDay: d.utcDay,
          name: c.name,
          family: c.family,
          element: c.element,
          role: c.role,
          rarity: c.rarity,
          variant: c.variant,
          power: c.stats.power,
          guard: c.stats.guard,
          speed: c.stats.speed,
          flavour: c.flavour,
          signature: c.signature,
          artSpec: JSON.stringify(c.artSpec),
          traits: { create: c.traits.map((traitId, slot) => ({ slot, traitId })) },
        },
      });
      await enqueueArtworkJob(tx, card.id);
      return card.id;
    });
    const card = await db.card.findUniqueOrThrow({ where: { id: cardId }, include: { traits: true } });
    return { card: toCardView(card), alreadyMinted: false };
  } catch (err) {
    // A concurrent request minted it first (unique discoveryId / ledger reference).
    if (isUniqueViolation(err)) {
      const raced = await findMintedCard(input.userId, input.discoveryId);
      if (raced) return { card: raced, alreadyMinted: true };
    }
    throw err;
  }
}

async function findMintedCard(userId: string, discoveryId: string): Promise<MintedCardView | null> {
  const card = await db.card.findUnique({ where: { discoveryId }, include: { traits: true } });
  if (!card || card.minterId !== userId) return null;
  return toCardView(card);
}

// ---------------------------------------------------------------------------
// Collection and detail
// ---------------------------------------------------------------------------

export const CollectionFilterSchema = z.object({
  family: z.enum(FAMILY_IDS).optional(),
  element: z.enum(ELEMENT_IDS).optional(),
  rarity: z.enum(RARITY_IDS).optional(),
});
export type CollectionFilter = z.infer<typeof CollectionFilterSchema>;

export async function listCollection(userId: string, filter: CollectionFilter = {}) {
  const f = CollectionFilterSchema.parse(filter);
  const [cards, total] = await Promise.all([
    db.card.findMany({
      where: { ownerId: userId, ...(f.family ? { family: f.family } : {}), ...(f.element ? { element: f.element } : {}), ...(f.rarity ? { rarity: f.rarity } : {}) },
      include: { traits: true },
      orderBy: { mintedAt: "desc" },
      take: 200,
    }),
    db.card.count({ where: { ownerId: userId } }),
  ]);
  return { cards: cards.map(toCardView), total };
}

export interface OwnerCardDetail {
  card: MintedCardView;
  provenance: { discoveryUtcDay: string; approxLocation: string; mintedUtcDay: string; seedPrefix: string; rulesetId: string };
  artworkEvents: { kind: string; createdAt: string }[];
}

export async function getOwnedCard(userId: string, cardId: string): Promise<OwnerCardDetail> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { traits: true, artworkEvents: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  if (!card || card.ownerId !== userId) throw new AppError("NOT_FOUND", "We couldn't find that card in your collection.");
  return {
    card: toCardView(card),
    provenance: {
      discoveryUtcDay: card.discoveryUtcDay,
      // Owner-only: coarse cell description. Never shown publicly.
      approxLocation: describeCell(card.locationCell),
      mintedUtcDay: card.mintedUtcDay,
      seedPrefix: card.seed.slice(0, 12),
      rulesetId: card.rulesetId,
    },
    artworkEvents: card.artworkEvents.map((e) => ({ kind: e.kind, createdAt: e.createdAt.toISOString() })),
  };
}

export async function getArtStatus(userId: string, cardId: string) {
  const card = await db.card.findUnique({ where: { id: cardId }, include: { traits: true } });
  if (!card || card.ownerId !== userId) throw new AppError("NOT_FOUND", "We couldn't find that card.");
  return toCardView(card).art;
}

// ---------------------------------------------------------------------------
// Public verification (live read, privacy-preserving)
// ---------------------------------------------------------------------------

const PublicIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

export interface PublicVerification {
  card: MintedCardView;
  owner: { isPublic: true; handle: string; displayName: string } | { isPublic: false };
  retrievedAt: string;
}

export async function getPublicVerification(publicId: string): Promise<PublicVerification | null> {
  if (!PublicIdSchema.safeParse(publicId).success) return null;
  const card = await db.card.findUnique({
    where: { publicVerificationId: publicId },
    include: { traits: true, owner: { select: { publicHandle: true, displayName: true, ownerIsPublic: true } } },
  });
  if (!card) return null;
  const o = card.owner;
  return {
    card: toCardView(card),
    owner: o.ownerIsPublic && o.publicHandle ? { isPublic: true, handle: o.publicHandle, displayName: o.displayName } : { isPublic: false },
    retrievedAt: new Date().toISOString(),
  };
}

/** For art serving: resolve an asset key for a card rendition. Art is public (it appears on verification pages). */
export async function artAssetKey(cardId: string, size: "display" | "thumb"): Promise<{ key: string; hash: string } | null> {
  if (!/^[a-z0-9]{20,40}$/i.test(cardId)) return null;
  const card = await db.card.findUnique({ where: { id: cardId }, select: { artStatus: true, artAssetKey: true, artThumbKey: true, artContentHash: true } });
  if (!card || card.artStatus !== "ART_READY" || !card.artContentHash) return null;
  const key = size === "display" ? card.artAssetKey : card.artThumbKey;
  return key ? { key, hash: card.artContentHash } : null;
}
