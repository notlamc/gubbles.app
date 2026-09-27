import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { discoverFromPayload } from "@/lib/discovery/service";
import { getPublicVerification, mintDiscovery } from "@/lib/cards/service";
import { updateProfile } from "@/lib/auth/service";
import { confirmedPlayer, uniqueSuffix } from "../support/helpers";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

async function mint() {
  const owner = await confirmedPlayer();
  const d = await discoverFromPayload({ userId: owner.userId, digest: digest(`verify-${uniqueSuffix()}`), cell: "gcpvj0", accuracyM: 20, now: new Date() });
  const { card } = await mintDiscovery({ userId: owner.userId, discoveryId: d.id });
  return { owner, card };
}

describe("public card verification", () => {
  it("shows the card and its current owner's public handle without private data", async () => {
    const { owner, card } = await mint();
    const v = await getPublicVerification(card.verification.publicId);
    expect(v).not.toBeNull();
    expect(v!.owner).toMatchObject({ isPublic: true, handle: owner.input.username.toLowerCase() });
    expect(Date.parse(v!.retrievedAt)).toBeGreaterThan(Date.now() - 5000);
    const row = await db.card.findUniqueOrThrow({ where: { id: card.id } });
    const text = JSON.stringify(v);
    for (const secret of [owner.input.email, owner.input.phone, owner.userId, row.locationCell, row.qrDigest, row.seed]) {
      expect(text).not.toContain(secret);
    }
  });

  it("respects an owner who hides their identity, while confirming the card exists", async () => {
    const { owner, card } = await mint();
    await updateProfile(owner.userId, { ownerIsPublic: false });
    const v = await getPublicVerification(card.verification.publicId);
    expect(v!.owner).toEqual({ isPublic: false });
    expect(v!.card.id).toBe(card.id);
  });

  it("returns null for invalid or unknown IDs", async () => {
    expect(await getPublicVerification("")).toBeNull();
    expect(await getPublicVerification("../../etc/passwd")).toBeNull();
    expect(await getPublicVerification("A".repeat(24))).toBeNull();
  });

  it("reflects a (simulated) ownership change immediately; the verification ID is unchanged", async () => {
    const { card } = await mint();
    const newOwner = await confirmedPlayer();
    // Trading isn't implemented: simulate the future transactional owner update directly.
    await db.card.update({ where: { id: card.id }, data: { ownerId: newOwner.userId } });
    const v = await getPublicVerification(card.verification.publicId);
    expect(v!.owner).toMatchObject({ isPublic: true, handle: newOwner.input.username.toLowerCase() });
    expect(v!.card.verification.publicId).toBe(card.verification.publicId);
  });
});
