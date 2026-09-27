import {
  ELEMENTS,
  FAMILIES,
  RARITIES,
  ROLES,
  TRAITS_BY_ID,
  VARIANTS,
  type ElementId,
  type FamilyId,
  type RarityId,
  type RoleId,
  type StatKey,
  type VariantId,
} from "@/lib/game/catalogue";
import type { ArtSpec, CardCandidate } from "@/lib/game/types";

/**
 * Presentation-ready card data shared by every renderer size (reveal, detail,
 * collection thumbnail) and returned by the JSON API for future clients.
 * Pure data — no rendering concerns.
 */
export interface CardFace {
  name: string;
  family: { id: FamilyId; name: string; number: number; code: string };
  element: { id: ElementId; name: string };
  role: { id: RoleId; name: string; blurb: string };
  rarity: { id: RarityId; name: string };
  variant: { id: VariantId; name: string };
  stats: Record<StatKey, number>;
  headline: { stat: StatKey; value: number };
  traits: { id: string; name: string; description: string; cost: number; icon: string }[];
  flavour: string;
  signature: string;
  artSpec: ArtSpec;
  rulesetId: string;
}

export type ArtStatus = "ART_PENDING" | "ART_READY" | "ART_FAILED";

export interface MintedCardView extends CardFace {
  id: string;
  cardNumber: string;
  mintedAt: string;
  art: {
    status: ArtStatus;
    url: string | null;
    thumbUrl: string | null;
    provider: string | null;
    model: string | null;
    isStub: boolean;
    generatedAt: string | null;
  };
  verification: { publicId: string; url: string };
}

export function cardFaceFromCandidate(c: CardCandidate): CardFace {
  const fam = FAMILIES[c.family];
  const role = ROLES[c.role];
  return {
    name: c.name,
    family: { id: fam.id, name: fam.name, number: fam.number, code: fam.code },
    element: { id: c.element, name: ELEMENTS[c.element].name },
    role: { id: role.id, name: role.name, blurb: role.blurb },
    rarity: { id: c.rarity, name: RARITIES[c.rarity].name },
    variant: { id: c.variant, name: VARIANTS[c.variant].name },
    stats: c.stats,
    headline: { stat: role.primary, value: c.stats[role.primary] },
    traits: c.traits.map((id) => {
      const t = TRAITS_BY_ID.get(id)!;
      return { id: t.id, name: t.name, description: t.description, cost: t.cost, icon: t.icon };
    }),
    flavour: c.flavour,
    signature: c.signature,
    artSpec: c.artSpec,
    rulesetId: c.rulesetId,
  };
}

export const STAT_LABELS: Record<StatKey, { name: string; explain: string }> = {
  power: { name: "Power", explain: "How hard this Gubble pushes when it acts." },
  guard: { name: "Guard", explain: "How well it shrugs off pushes and protects friends." },
  speed: { name: "Speed", explain: "How quickly it gets to act." },
};
