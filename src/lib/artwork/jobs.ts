import "server-only";
import sharp from "sharp";
import { AppError } from "@/lib/api/errors";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { ARTWORK, RATE_LIMITS } from "@/lib/game/constants";
import { parseArtSpec } from "@/lib/game/types";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { sha256Hex } from "@/lib/security/crypto";
import { sniffImageFormat } from "@/lib/discovery/qr-image";
import { ArtworkProviderError, type ArtworkGenerator } from "./generator";
import { OpenAiArtworkGenerator } from "./openai";
import { buildArtPrompt } from "./prompt";
import { assetStorage } from "./storage";
import { StubArtworkGenerator } from "./stub";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

let generator: ArtworkGenerator | null = null;

export function artworkGenerator(): ArtworkGenerator {
  if (generator) return generator;
  const e = env();
  if (e.ARTWORK_PROVIDER === "openai") {
    if (!e.OPENAI_API_KEY) throw new Error("ARTWORK_PROVIDER=openai requires OPENAI_API_KEY");
    generator = new OpenAiArtworkGenerator(e.OPENAI_API_KEY, e.ARTWORK_MODEL);
  } else {
    generator = new StubArtworkGenerator();
  }
  return generator;
}

export function setArtworkGeneratorForTests(g: ArtworkGenerator | null) {
  generator = g;
}

/** Enqueue generation for a freshly minted card inside the mint transaction. */
export async function enqueueArtworkJob(tx: Tx, cardId: string): Promise<void> {
  await tx.artworkJob.create({ data: { cardId, maxAttempts: ARTWORK.MAX_ATTEMPTS } });
  await tx.artworkEvent.create({ data: { cardId, kind: "QUEUED" } });
}

async function claimJob(jobId: string, now: Date): Promise<boolean> {
  const r = await db.artworkJob.updateMany({
    where: {
      id: jobId,
      OR: [
        { status: "QUEUED", nextRunAt: { lte: now } },
        // A worker that died mid-run: its lock has lapsed, so the job can be reclaimed.
        { status: "RUNNING", lockedUntil: { lt: now } },
      ],
    },
    data: { status: "RUNNING", lockedUntil: new Date(now.getTime() + ARTWORK.LOCK_MS), attempts: { increment: 1 } },
  });
  return r.count === 1;
}

function sanitizeError(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof ArtworkProviderError) return { message: err.message.slice(0, 200), retryable: err.retryable };
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) return { message: "provider timeout", retryable: true };
  if (err instanceof AppError) return { message: err.code, retryable: false };
  return { message: "unexpected artwork error", retryable: true };
}

/** Validate provider output and produce display + thumbnail renditions. */
async function processImage(bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > ARTWORK.MAX_PROVIDER_BYTES) throw new ArtworkProviderError("image size out of bounds", false);
  const format = sniffImageFormat(bytes);
  if (!format) throw new ArtworkProviderError("unsupported image format", false);
  const meta = await sharp(bytes, { limitInputPixels: ARTWORK.MAX_PROVIDER_EDGE ** 2, failOn: "error" }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 256 || h < 256 || w > ARTWORK.MAX_PROVIDER_EDGE || h > ARTWORK.MAX_PROVIDER_EDGE) {
    throw new ArtworkProviderError("image dimensions out of bounds", false);
  }
  const base = () => sharp(bytes, { failOn: "error" }).rotate();
  const [display, thumb] = await Promise.all([
    base().resize(ARTWORK.DISPLAY_SIZE, ARTWORK.DISPLAY_SIZE, { fit: "cover" }).webp({ quality: 88 }).toBuffer(),
    base().resize(ARTWORK.THUMB_SIZE, ARTWORK.THUMB_SIZE, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { format, width: w, height: h, display, thumb };
}

/** Run one claimed job to completion or failure. Never holds a DB transaction across generation. */
async function runJob(jobId: string): Promise<JobStatus> {
  const job = await db.artworkJob.findUniqueOrThrow({ where: { id: jobId }, include: { card: true } });
  const card = job.card;
  const gen = artworkGenerator();
  const spec = parseArtSpec(card.artSpec);
  const { prompt, version } = buildArtPrompt(spec);

  try {
    const result = await gen.generate(
      { cardId: card.id, prompt, promptVersion: version, artSpecJson: card.artSpec },
      AbortSignal.timeout(env().ARTWORK_TIMEOUT_MS),
    );
    const img = await processImage(result.bytes);
    const hash = sha256Hex(result.bytes);
    const prefix = `cards/${card.id.toLowerCase()}/${hash.slice(0, 16)}`;
    const storage = assetStorage();
    await storage.put(`${prefix}/original.${img.format}`, result.bytes, `image/${img.format}`);
    await storage.put(`${prefix}/display.webp`, img.display, "image/webp");
    await storage.put(`${prefix}/thumb.webp`, img.thumb, "image/webp");

    await db.$transaction(async (tx) => {
      // Approved artwork is immutable: only a pending card can receive art.
      const updated = await tx.card.updateMany({
        where: { id: card.id, artStatus: "ART_PENDING" },
        data: {
          artStatus: "ART_READY",
          artPromptVersion: version,
          artPrompt: prompt,
          artProvider: gen.provider,
          artModel: gen.model,
          artAssetKey: `${prefix}/display.webp`,
          artThumbKey: `${prefix}/thumb.webp`,
          artContentHash: hash,
          artMime: `image/${img.format}`,
          artWidth: img.width,
          artHeight: img.height,
          artGeneratedAt: new Date(),
        },
      });
      await tx.artworkJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", lockedUntil: null, lastError: null } });
      await tx.artworkEvent.create({
        data: { cardId: card.id, kind: updated.count ? "SUCCEEDED" : "SKIPPED_NOT_PENDING", detail: `${gen.provider}/${gen.model} sha256:${hash.slice(0, 16)}` },
      });
    });
    return "SUCCEEDED";
  } catch (err) {
    const { message, retryable } = sanitizeError(err);
    const current = await db.artworkJob.findUniqueOrThrow({ where: { id: job.id } });
    const exhausted = !retryable || current.attempts >= current.maxAttempts;
    await db.$transaction(async (tx) => {
      if (exhausted) {
        await tx.artworkJob.update({ where: { id: job.id }, data: { status: "FAILED", lockedUntil: null, lastError: message } });
        await tx.card.updateMany({ where: { id: card.id, artStatus: "ART_PENDING" }, data: { artStatus: "ART_FAILED" } });
        await tx.artworkEvent.create({ data: { cardId: card.id, kind: "FAILED", detail: message } });
      } else {
        const backoff = ARTWORK.RETRY_BASE_MS * 4 ** (current.attempts - 1);
        await tx.artworkJob.update({
          where: { id: job.id },
          data: { status: "QUEUED", lockedUntil: null, lastError: message, nextRunAt: new Date(Date.now() + backoff) },
        });
        await tx.artworkEvent.create({ data: { cardId: card.id, kind: "ATTEMPT_FAILED", detail: `attempt ${current.attempts}: ${message}` } });
      }
    });
    console.warn(`[gubbles:artwork] card=${card.id} attempt=${current.attempts} ${exhausted ? "FAILED" : "will retry"}: ${message}`);
    return exhausted ? "FAILED" : "QUEUED";
  }
}

/**
 * Claim and run due jobs. Safe to call concurrently from request `after()` hooks
 * and the standalone worker: claims are atomic conditional updates.
 */
export async function processDueArtworkJobs(opts: { cardId?: string; limit?: number; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const due = await db.artworkJob.findMany({
    where: {
      ...(opts.cardId ? { cardId: opts.cardId } : {}),
      OR: [
        { status: "QUEUED", nextRunAt: { lte: now } },
        { status: "RUNNING", lockedUntil: { lt: now } },
      ],
    },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 5,
    select: { id: true },
  });
  let ran = 0;
  for (const { id } of due) {
    if (await claimJob(id, now)) {
      await runJob(id);
      ran++;
    }
  }
  return ran;
}

/** Owner-initiated repair after ART_FAILED. Never re-mints or re-charges; audited. */
export async function retryFailedArtwork(userId: string, cardId: string): Promise<void> {
  await consumeRateLimit(`art-retry:${userId}`, RATE_LIMITS.artRetryPerUser);
  const card = await db.card.findUnique({ where: { id: cardId }, select: { ownerId: true, artStatus: true } });
  if (!card || card.ownerId !== userId) throw new AppError("NOT_FOUND", "We couldn't find that card.");
  if (card.artStatus !== "ART_FAILED") throw new AppError("ARTWORK_NOT_RETRYABLE", "This card's artwork isn't in a failed state.");
  await db.$transaction(async (tx) => {
    const flipped = await tx.card.updateMany({ where: { id: cardId, artStatus: "ART_FAILED" }, data: { artStatus: "ART_PENDING" } });
    if (flipped.count === 0) throw new AppError("ARTWORK_NOT_RETRYABLE", "Artwork is already being retried.");
    await tx.artworkJob.update({
      where: { cardId },
      data: { status: "QUEUED", attempts: 0, nextRunAt: new Date(), lockedUntil: null, lastError: null },
    });
    await tx.artworkEvent.create({ data: { cardId, kind: "MANUAL_RETRY", actorId: userId } });
  });
}
