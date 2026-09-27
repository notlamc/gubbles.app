import { createHash } from "node:crypto";
import {
  ELEMENTS,
  ELEMENT_IDS,
  FAMILIES,
  FAMILY_IDS,
  RARITIES,
  RARITY_IDS,
  ROLES,
  STAT_BUDGET,
  STAT_MAX,
  STAT_MIN,
  TRAITS_BY_ID,
  VARIANTS,
  VARIANT_IDS,
  compatibleTraits,
  type ElementId,
  type FamilyId,
  type RoleId,
  type StatKey,
} from "./catalogue";
import { encodeFields } from "./encoding";
import { DeterministicRng } from "./rng";
import type { ArtSpec, CardCandidate } from "./types";

/**
 * Deterministic card generation, ruleset "gubbles-v1". No AI, no I/O, no clocks.
 *
 * Inputs are already-derived identifiers (the server derives qrDigest and seed
 * with secret HMAC keys). Mapping layers:
 *   1. family            ← QR digest only             (a code always hides the same kind of Gubble)
 *   2. role              ← QR digest + UTC day         (the Gubble's mood changes day to day)
 *   3. element, variant, ← QR digest + UTC day + cell  (where and when you look matters)
 *      rarity
 *   4. stats split, traits, flavour, art details, signature
 *                        ← full player seed             (a minor personal signature)
 * Every layer uses a domain-separated HMAC-SHA256 stream (see rng.ts).
 */
export interface GenerationInput {
  rulesetId: string;
  qrDigest: string;
  utcDay: string;
  locationCell: string;
  /** Hex HMAC seed over (ruleset, player, qrDigest, day, cell). */
  seed: string;
}

function layerKey(fields: string[]): Buffer {
  return createHash("sha256").update(encodeFields(fields)).digest();
}

export function splitStats(rng: DeterministicRng, role: RoleId, budget: number): Record<StatKey, number> {
  const def = ROLES[role];
  const [pMin, pMax] = def.shares[def.primary];
  const [sMin, sMax] = def.shares[def.secondary];
  const [tMin, tMax] = def.shares[def.tertiary];
  let shares: [number, number, number] | null = null;
  for (let i = 0; i < 64 && !shares; i++) {
    const p = rng.range(pMin, pMax);
    const s = rng.range(sMin, sMax);
    const t = 100 - p - s;
    if (t >= tMin && t <= tMax) shares = [p, s, t];
  }
  // Deterministic fallback (never expected with the v1 share tables).
  shares ??= [pMin + 5, sMin + 3, 100 - (pMin + 5) - (sMin + 3)];

  const primary = Math.round((budget * shares[0]) / 100);
  const secondary = Math.round((budget * shares[1]) / 100);
  const tertiary = budget - primary - secondary;
  const stats = { power: 0, guard: 0, speed: 0 } as Record<StatKey, number>;
  stats[def.primary] = primary;
  stats[def.secondary] = secondary;
  stats[def.tertiary] = tertiary;
  for (const k of ["power", "guard", "speed"] as const) {
    if (stats[k] < STAT_MIN || stats[k] > STAT_MAX) throw new Error(`stat ${k} out of bounds`);
  }
  return stats;
}

export function generateCandidate(input: GenerationInput): CardCandidate {
  const { rulesetId, qrDigest, utcDay, locationCell, seed } = input;

  // 1. Family from the QR digest alone.
  const familyRng = new DeterministicRng(layerKey(["family", rulesetId, qrDigest]), "family");
  const family: FamilyId = familyRng.pick(FAMILY_IDS);
  const fam = FAMILIES[family];

  // 2. Role from digest + day, limited to the family's roles.
  const roleRng = new DeterministicRng(layerKey(["role", rulesetId, qrDigest, utcDay]), "role");
  const role: RoleId = roleRng.pick(fam.roles);

  // 3. Element, variant and rarity from digest + day + location cell.
  const envRng = new DeterministicRng(layerKey(["env", rulesetId, qrDigest, utcDay, locationCell]), "env");
  const element: ElementId = envRng.weighted(ELEMENT_IDS.map((e) => [e, e === fam.nativeElement ? 5 : 2] as const));
  const variant = envRng.weighted(VARIANT_IDS.map((v) => [v, VARIANTS[v].weight] as const));
  const rarity = envRng.weighted(RARITY_IDS.map((r) => [r, RARITIES[r].weight] as const));

  // 4. Personal layer from the full seed.
  const seedBytes = Buffer.from(seed, "hex");
  const personal = new DeterministicRng(seedBytes, "personal");
  const pool = compatibleTraits(element, role);
  const first = personal.pick(pool);
  const second = personal.pick(pool.filter((t) => t.id !== first.id));
  const traits = [first.id, second.id].sort((a, b) => {
    // Canonical order: catalogue order, so the tuple is stable regardless of pick order.
    const ids = [...TRAITS_BY_ID.keys()];
    return ids.indexOf(a) - ids.indexOf(b);
  }) as [string, string];
  const budget = STAT_BUDGET - first.cost - second.cost;
  const stats = splitStats(personal, role, budget);
  const flavour = personal.pick(fam.flavours).replace("{habitat}", ELEMENTS[element].habitat);
  const signature = seedBytes.subarray(0, 2).toString("hex").toUpperCase();

  const v = VARIANTS[variant];
  const hue = (((ELEMENTS[element].hue + v.hueShift + personal.range(-12, 12)) % 360) + 360) % 360;
  const artSpec: ArtSpec = {
    v: 1,
    family,
    element,
    variant,
    rarity,
    hue,
    accentHue: (hue + 150 + personal.range(-20, 20) + 360) % 360,
    pattern: v.pattern,
    eyes: personal.pick(["round", "sparkle", "sleepy"] as const),
    mouth: personal.pick(["grin", "open", "smirk"] as const),
    cheeks: personal.int(2) === 1,
    sig: signature,
  };

  return {
    v: 1,
    rulesetId,
    name: fam.name,
    family,
    element,
    role,
    rarity,
    variant,
    stats,
    traits,
    flavour,
    signature,
    artSpec,
  };
}
