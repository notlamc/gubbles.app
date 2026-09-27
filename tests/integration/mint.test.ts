import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { discoverFromPayload } from "@/lib/discovery/service";
import { getOwnedCard, listCollection, mintDiscovery } from "@/lib/cards/service";
import { GAME } from "@/lib/game/constants";
import { confirmedPlayer, ledgerSum, uniqueSuffix } from "../support/helpers";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

async function preview(userId: string, now = new Date()) {
  return discoverFromPayload({ userId, digest: digest(`mint-${uniqueSuffix()}`), cell: "gcpvj0", accuracyM: 20, now });
}

async function expectLedgerConsistent(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  expect(await ledgerSum(userId)).toBe(user.creditBalance);
  expect(user.creditBalance).toBeGreaterThanOrEqual(0);
  const rows = await db.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  for (const r of rows) expect(r.balanceAfter).toBeGreaterThanOrEqual(0);
}

describe("minting", () => {
  it("mints the exact previewed candidate, debits once, and creates an ART_PENDING card with a queued job", async () => {
    const { userId } = await confirmedPlayer();
    const d = await preview(userId);
    const { card, alreadyMinted } = await mintDiscovery({ userId, discoveryId: d.id });
    expect(alreadyMinted).toBe(false);
    expect(card.name).toBe(d.card.name);
    expect(card.stats).toEqual(d.card.stats);
    expect(card.traits).toEqual(d.card.traits);
    expect(card.artSpec).toEqual(d.card.artSpec);
    expect(card.art.status).toBe("ART_PENDING");
    expect(card.verification.publicId.length).toBeGreaterThanOrEqual(24);
    expect(card.verification.url).toBe(`http://localhost:3000/verify/cards/${card.verification.publicId}`);
    const row = await db.card.findUniqueOrThrow({ where: { id: card.id }, include: { artworkJob: true, discovery: true } });
    expect(row.seed).toBe(row.discovery.seed);
    expect(row.rulesetId).toBe(GAME.RULESET_ID);
    expect(row.artworkJob?.status).toBe("QUEUED");
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.creditBalance).toBe(GAME.STARTING_DEMO_CREDIT - GAME.MINT_COST);
    await expectLedgerConsistent(userId);
  });

  it("is idempotent: retries return the same card without a second debit", async () => {
    const { userId } = await confirmedPlayer();
    const d = await preview(userId);
    const a = await mintDiscovery({ userId, discoveryId: d.id });
    const b = await mintDiscovery({ userId, discoveryId: d.id });
    expect(b.alreadyMinted).toBe(true);
    expect(b.card.id).toBe(a.card.id);
    expect(await db.card.count({ where: { discoveryId: d.id } })).toBe(1);
    expect(await db.creditLedger.count({ where: { userId, reason: "MINT" } })).toBe(1);
    await expectLedgerConsistent(userId);
  });

  it("concurrent mint requests create exactly one card and one debit", async () => {
    const { userId } = await confirmedPlayer();
    const d = await preview(userId);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => mintDiscovery({ userId, discoveryId: d.id })));
    const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof mintDiscovery>>>).value);
    expect(ok.length).toBeGreaterThan(0);
    expect(new Set(ok.map((r) => r.card.id)).size).toBe(1);
    expect(await db.card.count({ where: { discoveryId: d.id } })).toBe(1);
    expect(await db.creditLedger.count({ where: { userId, reason: "MINT" } })).toBe(1);
    expect(await db.artworkJob.count({ where: { card: { discoveryId: d.id } } })).toBe(1);
    await expectLedgerConsistent(userId);
  });

  it("rejects insufficient credit without creating a card or going negative", async () => {
    const { userId } = await confirmedPlayer();
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { creditBalance: 0 } }),
      db.creditLedger.create({ data: { userId, delta: -GAME.STARTING_DEMO_CREDIT, balanceAfter: 0, reason: "MINT", referenceId: `drain-${userId}` } }),
    ]);
    const d = await preview(userId);
    await expect(mintDiscovery({ userId, discoveryId: d.id })).rejects.toMatchObject({ code: "INSUFFICIENT_CREDIT" });
    expect(await db.card.count({ where: { discoveryId: d.id } })).toBe(0);
    await expectLedgerConsistent(userId);
  });

  it("rejects expired previews and other players' discoveries", async () => {
    const a = await confirmedPlayer();
    const b = await confirmedPlayer();
    const d = await preview(a.userId);
    await expect(mintDiscovery({ userId: b.userId, discoveryId: d.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(mintDiscovery({ userId: a.userId, discoveryId: "nonexistent" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const later = new Date(Date.now() + GAME.DISCOVERY_PREVIEW_TTL_MS + 1000);
    await expect(mintDiscovery({ userId: a.userId, discoveryId: d.id, now: later })).rejects.toMatchObject({ code: "DISCOVERY_EXPIRED" });
    await expectLedgerConsistent(a.userId);
  });

  it("enforces the daily mint cap transactionally (no debit when capped)", async () => {
    const { userId } = await confirmedPlayer();
    const now = new Date();
    for (let i = 0; i < GAME.DAILY_MINT_CAP; i++) {
      const d = await preview(userId, now);
      await mintDiscovery({ userId, discoveryId: d.id, now });
    }
    const extra = await preview(userId, now);
    const before = (await db.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance;
    await expect(mintDiscovery({ userId, discoveryId: extra.id, now })).rejects.toMatchObject({ code: "DAILY_MINT_CAP" });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance).toBe(before);
    await expectLedgerConsistent(userId);
  });

  it("collection lists owned cards with filters; detail is owner-only", async () => {
    const a = await confirmedPlayer();
    const b = await confirmedPlayer();
    const d1 = await preview(a.userId);
    const d2 = await preview(a.userId);
    const c1 = (await mintDiscovery({ userId: a.userId, discoveryId: d1.id })).card;
    await mintDiscovery({ userId: a.userId, discoveryId: d2.id });
    const all = await listCollection(a.userId);
    expect(all.total).toBe(2);
    const byFamily = await listCollection(a.userId, { family: c1.family.id });
    expect(byFamily.cards.every((c) => c.family.id === c1.family.id)).toBe(true);
    await expect(listCollection(a.userId, { family: "dragon" as never })).rejects.toThrow();
    expect((await listCollection(b.userId)).total).toBe(0);
    await expect(getOwnedCard(b.userId, c1.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const detail = await getOwnedCard(a.userId, c1.id);
    expect(detail.provenance.approxLocation).toMatch(/≈/);
  });
});
