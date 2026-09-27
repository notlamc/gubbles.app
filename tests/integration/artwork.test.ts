import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { discoverFromPayload } from "@/lib/discovery/service";
import { mintDiscovery, artAssetKey } from "@/lib/cards/service";
import { processDueArtworkJobs, retryFailedArtwork, setArtworkGeneratorForTests } from "@/lib/artwork/jobs";
import { assetStorage } from "@/lib/artwork/storage";
import { StubArtworkGenerator } from "@/lib/artwork/stub";
import { ArtworkProviderError, type ArtworkGenerator } from "@/lib/artwork/generator";
import { buildArtPrompt } from "@/lib/artwork/prompt";
import { ARTWORK, GAME } from "@/lib/game/constants";
import { confirmedPlayer, ledgerSum, uniqueSuffix } from "../support/helpers";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

async function mintedCard() {
  const { userId } = await confirmedPlayer();
  const d = await discoverFromPayload({ userId, digest: digest(`art-${uniqueSuffix()}`), cell: "gcpvj0", accuracyM: 20, now: new Date() });
  const { card } = await mintDiscovery({ userId, discoveryId: d.id });
  return { userId, cardId: card.id };
}

/** Make every queued retry due now (skips real backoff waits). */
async function fastForward(cardId: string) {
  await db.artworkJob.update({ where: { cardId }, data: { nextRunAt: new Date(Date.now() - 1) } });
}

afterEach(() => setArtworkGeneratorForTests(null));

describe("artwork generation jobs", () => {
  it("generates, validates, stores renditions and marks the card ready with provenance", async () => {
    setArtworkGeneratorForTests(new StubArtworkGenerator());
    const { cardId } = await mintedCard();
    expect(await processDueArtworkJobs({ cardId })).toBe(1);
    const card = await db.card.findUniqueOrThrow({ where: { id: cardId }, include: { artworkJob: true, artworkEvents: true } });
    expect(card.artStatus).toBe("ART_READY");
    expect(card.artProvider).toBe("local-stub");
    expect(card.artPromptVersion).toBe(ARTWORK.PROMPT_TEMPLATE_VERSION);
    expect(card.artContentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(card.artworkJob?.status).toBe("SUCCEEDED");
    expect(card.artworkEvents.map((e) => e.kind)).toEqual(expect.arrayContaining(["QUEUED", "SUCCEEDED"]));
    const display = await assetStorage().get(card.artAssetKey!);
    const thumb = await assetStorage().get(card.artThumbKey!);
    expect((await sharp(display!).metadata()).width).toBe(ARTWORK.DISPLAY_SIZE);
    expect((await sharp(thumb!).metadata()).width).toBe(ARTWORK.THUMB_SIZE);
    expect(await artAssetKey(cardId, "display")).toMatchObject({ key: card.artAssetKey });
  });

  it("is idempotent: processing again does not regenerate approved art", async () => {
    let calls = 0;
    const stub = new StubArtworkGenerator();
    setArtworkGeneratorForTests({ ...stub, provider: stub.provider, model: stub.model, isAi: false, generate: (r, s) => (calls++, stub.generate(r, s)) } as ArtworkGenerator);
    const { cardId } = await mintedCard();
    await processDueArtworkJobs({ cardId });
    const before = await db.card.findUniqueOrThrow({ where: { id: cardId } });
    await processDueArtworkJobs({ cardId });
    await Promise.all([processDueArtworkJobs({ cardId }), processDueArtworkJobs({ cardId })]);
    const after = await db.card.findUniqueOrThrow({ where: { id: cardId } });
    expect(calls).toBe(1);
    expect(after.artContentHash).toBe(before.artContentHash);
  });

  it("concurrent workers claim a job only once", async () => {
    let calls = 0;
    const stub = new StubArtworkGenerator({ delayMs: 50 });
    setArtworkGeneratorForTests({ provider: stub.provider, model: stub.model, isAi: false, generate: (r, s) => (calls++, stub.generate(r, s)) });
    const { cardId } = await mintedCard();
    await Promise.all(Array.from({ length: 4 }, () => processDueArtworkJobs({ cardId })));
    expect(calls).toBe(1);
  });

  it("retries transient failures with backoff, then succeeds", async () => {
    setArtworkGeneratorForTests(new StubArtworkGenerator({ failTimes: () => 2 }));
    const { cardId } = await mintedCard();
    await processDueArtworkJobs({ cardId });
    let job = await db.artworkJob.findUniqueOrThrow({ where: { cardId } });
    expect(job.status).toBe("QUEUED");
    expect(job.attempts).toBe(1);
    expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    // Not due yet → nothing runs.
    expect(await processDueArtworkJobs({ cardId })).toBe(0);
    await fastForward(cardId);
    await processDueArtworkJobs({ cardId });
    await fastForward(cardId);
    await processDueArtworkJobs({ cardId });
    job = await db.artworkJob.findUniqueOrThrow({ where: { cardId } });
    expect(job.status).toBe("SUCCEEDED");
    expect(job.attempts).toBe(3);
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).artStatus).toBe("ART_READY");
  });

  it("marks ART_FAILED after bounded attempts, keeps card and credit, and supports audited manual retry without re-charging", async () => {
    setArtworkGeneratorForTests(new StubArtworkGenerator({ failTimes: () => 99 }));
    const { cardId, userId } = await mintedCard();
    for (let i = 0; i < ARTWORK.MAX_ATTEMPTS; i++) {
      await fastForward(cardId);
      await processDueArtworkJobs({ cardId });
    }
    let card = await db.card.findUniqueOrThrow({ where: { id: cardId }, include: { artworkJob: true } });
    expect(card.artStatus).toBe("ART_FAILED");
    expect(card.artworkJob?.status).toBe("FAILED");
    expect(card.artworkJob?.lastError).toBe("stub: injected failure");
    const balance = (await db.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance;
    expect(balance).toBe(GAME.STARTING_DEMO_CREDIT - GAME.MINT_COST);

    // Another player can't retry it; a non-failed card can't be retried.
    const other = await confirmedPlayer();
    await expect(retryFailedArtwork(other.userId, cardId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    setArtworkGeneratorForTests(new StubArtworkGenerator());
    await retryFailedArtwork(userId, cardId);
    await expect(retryFailedArtwork(userId, cardId)).rejects.toMatchObject({ code: "ARTWORK_NOT_RETRYABLE" });
    await processDueArtworkJobs({ cardId });
    card = await db.card.findUniqueOrThrow({ where: { id: cardId }, include: { artworkJob: true, artworkEvents: true } });
    expect(card.artStatus).toBe("ART_READY");
    expect(card.artworkEvents.some((e) => e.kind === "MANUAL_RETRY" && e.actorId === userId)).toBe(true);
    // Still exactly one card and one mint debit.
    expect(await db.card.count({ where: { discoveryId: card.discoveryId } })).toBe(1);
    expect(await db.creditLedger.count({ where: { userId, reason: "MINT" } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance).toBe(balance);
    expect(await ledgerSum(userId)).toBe(balance);
  });

  it("non-retryable provider errors fail immediately; invalid provider output is rejected", async () => {
    setArtworkGeneratorForTests({
      provider: "test",
      model: "bad",
      isAi: true,
      generate: async () => {
        throw new ArtworkProviderError("provider HTTP 400", false);
      },
    });
    const a = await mintedCard();
    await processDueArtworkJobs({ cardId: a.cardId });
    expect((await db.card.findUniqueOrThrow({ where: { id: a.cardId } })).artStatus).toBe("ART_FAILED");

    setArtworkGeneratorForTests({ provider: "test", model: "garbage", isAi: true, generate: async () => ({ bytes: Buffer.from("not an image"), mime: "image/png" }) });
    const b = await mintedCard();
    await processDueArtworkJobs({ cardId: b.cardId });
    const job = await db.artworkJob.findUniqueOrThrow({ where: { cardId: b.cardId } });
    expect(job.status).toBe("FAILED");
    expect(job.lastError).toBe("unsupported image format");
  });

  it("recovers jobs whose worker died mid-run (lapsed lock)", async () => {
    setArtworkGeneratorForTests(new StubArtworkGenerator());
    const { cardId } = await mintedCard();
    await db.artworkJob.update({ where: { cardId }, data: { status: "RUNNING", lockedUntil: new Date(Date.now() - 1000), attempts: 1 } });
    await processDueArtworkJobs({ cardId });
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).artStatus).toBe("ART_READY");
  });

  it("art prompts contain only fixed card attributes and forbid text/frames", async () => {
    const { cardId } = await mintedCard();
    const card = await db.card.findUniqueOrThrow({ where: { id: cardId }, include: { owner: true } });
    const { prompt } = buildArtPrompt(JSON.parse(card.artSpec));
    expect(prompt).not.toContain(card.locationCell);
    expect(prompt).not.toContain(card.qrDigest);
    expect(prompt).not.toContain(card.owner.email);
    expect(prompt).not.toContain(card.owner.usernameDisplay);
    expect(prompt).toMatch(/no text/i);
  });
});
