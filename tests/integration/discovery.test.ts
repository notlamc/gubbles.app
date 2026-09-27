import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { discoverFromImage, discoverFromPayload, getDiscovery } from "@/lib/discovery/service";
import { extractSingleQrPayload } from "@/lib/discovery/qr-image";
import { signUp } from "@/lib/auth/service";
import { GAME, UPLOAD } from "@/lib/game/constants";
import { confirmedPlayer, fixture, freshLocation, newSignup, uniqueSuffix } from "../support/helpers";
import { createHash } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

describe("QR image validation", () => {
  it("decodes exactly one QR from PNG, JPEG and WebP", async () => {
    expect(await extractSingleQrPayload(fixture("qr-single.png"))).toBe("https://example.com/gubbles/park-bench-42");
    expect(await extractSingleQrPayload(fixture("qr-single-2.jpg"))).toBe("GUBBLES-FIXTURE: lighthouse café ☕");
    expect(await extractSingleQrPayload(fixture("qr-single-3.webp"))).toBe("  Plain text code with padding  ");
  });

  it("rejects images with no QR or several QRs", async () => {
    await expect(extractSingleQrPayload(fixture("no-qr.png"))).rejects.toMatchObject({ code: "QR_NOT_FOUND" });
    await expect(extractSingleQrPayload(fixture("qr-multiple.png"))).rejects.toMatchObject({ code: "QR_MULTIPLE" });
  });

  it("rejects malformed, unsupported, empty and oversized uploads", async () => {
    await expect(extractSingleQrPayload(new Uint8Array())).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    await expect(extractSingleQrPayload(new TextEncoder().encode("definitely not an image"))).rejects.toMatchObject({ code: "IMAGE_UNSUPPORTED" });
    const gif = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).gif().toBuffer();
    await expect(extractSingleQrPayload(new Uint8Array(gif))).rejects.toMatchObject({ code: "IMAGE_UNSUPPORTED" });
    // PNG magic bytes followed by garbage.
    const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(7)]);
    await expect(extractSingleQrPayload(fake)).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    const huge = new Uint8Array(UPLOAD.MAX_BYTES + 1);
    huge.set(fixture("qr-single.png"));
    await expect(extractSingleQrPayload(huge)).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
  });

  it("rejects images whose pixel dimensions exceed limits (decompression bombs)", async () => {
    const big = await sharp({ create: { width: UPLOAD.MAX_WIDTH + 10, height: 100, channels: 3, background: "#fff" } }).png({ compressionLevel: 9, palette: true }).toBuffer();
    await expect(extractSingleQrPayload(new Uint8Array(big))).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
  });
});

describe("discovery", () => {
  it("requires confirmed email and phone", async () => {
    const { userId } = await signUp(newSignup(), { ip: `ip-${uniqueSuffix()}` });
    await expect(discoverFromImage({ userId, image: fixture("qr-single.png"), location: freshLocation() })).rejects.toMatchObject({ code: "ACCOUNT_NOT_CONFIRMED" });
  });

  it("validates location before decoding", async () => {
    const { userId } = await confirmedPlayer();
    await expect(discoverFromImage({ userId, image: fixture("qr-single.png"), location: null })).rejects.toMatchObject({ code: "LOCATION_INVALID" });
    await expect(discoverFromImage({ userId, image: fixture("qr-single.png"), location: { ...freshLocation(), timestamp: Date.now() - 10 * 60_000 } })).rejects.toMatchObject({ code: "LOCATION_STALE" });
  });

  it("creates a deterministic preview; same-day rescans return the same candidate, even from another cell", async () => {
    const { userId } = await confirmedPlayer();
    const first = await discoverFromImage({ userId, image: fixture("qr-single.png"), location: freshLocation() });
    expect(first.reused).toBe(false);
    expect(first.mint.cost).toBe(GAME.MINT_COST);
    const again = await discoverFromImage({ userId, image: fixture("qr-single.png"), location: freshLocation() });
    expect(again.id).toBe(first.id);
    expect(again.reused).toBe(true);
    expect(again.card).toEqual(first.card);
    expect(again.locationLocked).toBe(false);
    const elsewhere = await discoverFromImage({ userId, image: fixture("qr-single.png"), location: freshLocation(Date.now(), 40.7128, -74.006) });
    expect(elsewhere.id).toBe(first.id);
    expect(elsewhere.card).toEqual(first.card);
    expect(elsewhere.locationLocked).toBe(true);

    // Nothing about the raw payload or exact coordinates is stored.
    const d = await db.discovery.findUniqueOrThrow({ where: { id: first.id }, include: { source: true } });
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain("park-bench");
    expect(serialized).not.toContain("51.5074");
    expect(d.locationCell).toHaveLength(GAME.LOCATION_CELL_PRECISION);
  });

  it("the same code on a later UTC day can produce a different candidate; family stays the same", async () => {
    const { userId } = await confirmedPlayer();
    const q = digest(`later-day-${uniqueSuffix()}`);
    const day1 = await discoverFromPayload({ userId, digest: q, cell: "gcpvj0", accuracyM: 20, now: new Date("2026-09-27T23:59:00Z") });
    const day2 = await discoverFromPayload({ userId, digest: q, cell: "gcpvj0", accuracyM: 20, now: new Date("2026-09-28T00:01:00Z") });
    expect(day2.id).not.toBe(day1.id);
    expect(day2.utcDay).toBe("2026-09-28");
    expect(day2.card.family.id).toBe(day1.card.family.id);
    const seeds = await db.discovery.findMany({ where: { id: { in: [day1.id, day2.id] } }, select: { seed: true } });
    expect(seeds[0]!.seed).not.toBe(seeds[1]!.seed);
  });

  it("different players get personal variations of the same code", async () => {
    const a = await confirmedPlayer();
    const b = await confirmedPlayer();
    const q = digest(`shared-${uniqueSuffix()}`);
    const now = new Date();
    const da = await discoverFromPayload({ userId: a.userId, digest: q, cell: "gcpvj0", accuracyM: 20, now });
    const dbb = await discoverFromPayload({ userId: b.userId, digest: q, cell: "gcpvj0", accuracyM: 20, now });
    expect(da.card.family).toEqual(dbb.card.family);
    expect(da.card.element).toEqual(dbb.card.element);
    expect(da.card.signature).not.toBe(dbb.card.signature);
  });

  it("concurrent scans of the same code return one discovery", async () => {
    const { userId } = await confirmedPlayer();
    const q = digest(`concurrent-${uniqueSuffix()}`);
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 6 }, () => discoverFromPayload({ userId, digest: q, cell: "u4pruy", accuracyM: 20, now })));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await db.discovery.count({ where: { playerId: userId } })).toBe(1);
  });

  it("enforces the daily discovery cap on new discoveries only; re-scans and failed uploads don't count", async () => {
    const { userId } = await confirmedPlayer();
    const now = new Date("2026-10-01T10:00:00Z");
    // Failed uploads (no QR) don't consume allowance.
    for (let i = 0; i < 3; i++) {
      await expect(discoverFromImage({ userId, image: fixture("no-qr.png"), location: freshLocation(now.getTime()), now })).rejects.toMatchObject({ code: "QR_NOT_FOUND" });
    }
    const ids: string[] = [];
    for (let i = 0; i < GAME.DAILY_DISCOVERY_CAP; i++) {
      ids.push((await discoverFromPayload({ userId, digest: digest(`cap-${userId}-${i}`), cell: "gcpvj0", accuracyM: 20, now })).id);
    }
    await expect(discoverFromPayload({ userId, digest: digest(`cap-${userId}-extra`), cell: "gcpvj0", accuracyM: 20, now })).rejects.toMatchObject({ code: "DAILY_DISCOVERY_CAP" });
    // Re-scanning an existing code today still works.
    const rescan = await discoverFromPayload({ userId, digest: digest(`cap-${userId}-0`), cell: "gcpvj0", accuracyM: 20, now });
    expect(rescan.id).toBe(ids[0]);
    // A new UTC day resets the allowance.
    const tomorrow = new Date("2026-10-02T00:00:01Z");
    await expect(discoverFromPayload({ userId, digest: digest(`cap-${userId}-extra`), cell: "gcpvj0", accuracyM: 20, now: tomorrow })).resolves.toBeTruthy();
  });

  it("only the owner can read a discovery", async () => {
    const a = await confirmedPlayer();
    const b = await confirmedPlayer();
    const d = await discoverFromPayload({ userId: a.userId, digest: digest(`own-${uniqueSuffix()}`), cell: "gcpvj0", accuracyM: 20, now: new Date() });
    await expect(getDiscovery(b.userId, d.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDiscovery(a.userId, d.id)).resolves.toMatchObject({ id: d.id });
  });
});
