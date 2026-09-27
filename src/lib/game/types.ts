import { z } from "zod";
import { ELEMENT_IDS, FAMILY_IDS, RARITY_IDS, ROLE_IDS, TRAITS_BY_ID, VARIANT_IDS } from "./catalogue";

export const ArtSpecSchema = z.object({
  v: z.literal(1),
  family: z.enum(FAMILY_IDS),
  element: z.enum(ELEMENT_IDS),
  variant: z.enum(VARIANT_IDS),
  rarity: z.enum(RARITY_IDS),
  hue: z.number().int().min(0).max(359),
  accentHue: z.number().int().min(0).max(359),
  pattern: z.enum(["none", "spots", "bands", "stars"]),
  eyes: z.enum(["round", "sparkle", "sleepy"]),
  mouth: z.enum(["grin", "open", "smirk"]),
  cheeks: z.boolean(),
  sig: z.string().regex(/^[0-9A-F]{4}$/),
});
export type ArtSpec = z.infer<typeof ArtSpecSchema>;

const traitId = z.string().refine((id) => TRAITS_BY_ID.has(id), "unknown trait");

/** A generated, not-yet-minted card. Serialized into Discovery.candidate. */
export const CardCandidateSchema = z.object({
  v: z.literal(1),
  rulesetId: z.string(),
  name: z.string(),
  family: z.enum(FAMILY_IDS),
  element: z.enum(ELEMENT_IDS),
  role: z.enum(ROLE_IDS),
  rarity: z.enum(RARITY_IDS),
  variant: z.enum(VARIANT_IDS),
  stats: z.object({ power: z.number().int(), guard: z.number().int(), speed: z.number().int() }),
  traits: z.tuple([traitId, traitId]),
  flavour: z.string(),
  signature: z.string(),
  artSpec: ArtSpecSchema,
});
export type CardCandidate = z.infer<typeof CardCandidateSchema>;

export function serializeCandidate(c: CardCandidate): string {
  return JSON.stringify(CardCandidateSchema.parse(c));
}

export function parseCandidate(text: string): CardCandidate {
  return CardCandidateSchema.parse(JSON.parse(text));
}

export function parseArtSpec(text: string): ArtSpec {
  return ArtSpecSchema.parse(JSON.parse(text));
}
