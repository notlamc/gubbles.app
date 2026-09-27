import "server-only";
import { createHash } from "node:crypto";
import { generateCandidate } from "@/lib/game/generate";
import type { FamilyId, RarityId } from "@/lib/game/catalogue";
import { cardFaceFromCandidate, type CardFace } from "./view";

const hex = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Deterministic showcase cards for marketing pages (never minted, never owned).
 * Searches fixed inputs for the requested family/rarity so the result is stable.
 */
export function sampleFace(family: FamilyId, minRarity: RarityId = "common"): CardFace {
  const order: RarityId[] = ["common", "uncommon", "rare", "epic", "mythic"];
  for (let i = 0; i < 20_000; i++) {
    const c = generateCandidate({
      rulesetId: "gubbles-v1",
      qrDigest: hex(`showcase-${family}-${i % 97}`),
      utcDay: "2026-09-27",
      locationCell: `show${i}`,
      seed: hex(`showcase-seed-${i}`),
    });
    if (c.family === family && order.indexOf(c.rarity) >= order.indexOf(minRarity)) return cardFaceFromCandidate(c);
  }
  throw new Error("no sample found");
}
