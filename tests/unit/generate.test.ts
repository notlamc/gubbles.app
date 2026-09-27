import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ELEMENT_IDS,
  FAMILIES,
  ROLE_IDS,
  ROLES,
  STAT_BUDGET,
  STAT_MAX,
  STAT_MIN,
  TRAITS_BY_ID,
  compatibleTraits,
} from "@/lib/game/catalogue";
import { GAME } from "@/lib/game/constants";
import { generateCandidate, type GenerationInput } from "@/lib/game/generate";
import { cardSeed, qrDigest } from "@/lib/game/seed";
import { CardCandidateSchema } from "@/lib/game/types";

const hex = (s: string) => createHash("sha256").update(s).digest("hex");

function input(i: number, overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    rulesetId: GAME.RULESET_ID,
    qrDigest: hex(`qr-${i % 37}`),
    utcDay: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
    locationCell: ["gcpvj0", "u4pruy", "9q8yyk", "dr5reg"][i % 4]!,
    seed: hex(`seed-${i}`),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("deterministic generation", () => {
  it("is repeatable for identical inputs", () => {
    for (let i = 0; i < 20; i++) expect(generateCandidate(input(i))).toEqual(generateCandidate(input(i)));
  });

  it("never uses Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random used in card generation");
    });
    for (let i = 0; i < 50; i++) generateCandidate(input(i));
    expect(spy).not.toHaveBeenCalled();
  });

  it("family depends only on the QR digest", () => {
    const base = input(3);
    const fam = generateCandidate(base).family;
    for (let i = 0; i < 30; i++) {
      const c = generateCandidate({ ...base, utcDay: `2027-01-${String((i % 28) + 1).padStart(2, "0")}`, locationCell: `cell${i}`, seed: hex(`other-${i}`) });
      expect(c.family).toBe(fam);
    }
  });

  it("location cell and day influence element/variant/rarity", () => {
    const base = input(5);
    const envs = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const c = generateCandidate({ ...base, locationCell: `c${i}` });
      envs.add(`${c.element}/${c.variant}/${c.rarity}`);
    }
    expect(envs.size).toBeGreaterThan(5);
  });

  it("ruleset output is stable (golden vector — changing this requires a new RULESET_ID)", () => {
    const c = generateCandidate({
      rulesetId: "gubbles-v1",
      qrDigest: hex("golden-qr"),
      utcDay: "2026-09-27",
      locationCell: "gcpvj0",
      seed: hex("golden-seed"),
    });
    expect(c).toMatchInlineSnapshot(`
      {
        "artSpec": {
          "accentHue": 174,
          "cheeks": false,
          "element": "ember",
          "eyes": "sleepy",
          "family": "shardling",
          "hue": 23,
          "mouth": "open",
          "pattern": "spots",
          "rarity": "common",
          "sig": "F3B8",
          "v": 1,
          "variant": "speckled",
        },
        "element": "ember",
        "family": "shardling",
        "flavour": "Clinks softly when it walks. Very softly. It's shy.",
        "name": "Shardling",
        "rarity": "common",
        "role": "striker",
        "rulesetId": "gubbles-v1",
        "signature": "F3B8",
        "stats": {
          "guard": 34,
          "power": 70,
          "speed": 39,
        },
        "traits": [
          "cinder-snap",
          "big-heart",
        ],
        "v": 1,
        "variant": "speckled",
      }
    `);
  });

  it("produces schema-valid candidates with compatible traits and exact stat budgets", () => {
    for (let i = 0; i < 2000; i++) {
      const c = generateCandidate(input(i));
      expect(() => CardCandidateSchema.parse(c)).not.toThrow();
      const fam = FAMILIES[c.family];
      expect(fam.roles).toContain(c.role);
      const [a, b] = c.traits.map((id) => TRAITS_BY_ID.get(id)!);
      expect(a!.id).not.toBe(b!.id);
      for (const t of [a!, b!]) {
        expect(t.elements.length === 0 || t.elements.includes(c.element)).toBe(true);
        expect(t.roles.length === 0 || t.roles.includes(c.role)).toBe(true);
      }
      const { power, guard, speed } = c.stats;
      expect(power + guard + speed).toBe(STAT_BUDGET - a!.cost - b!.cost);
      for (const v of [power, guard, speed]) {
        expect(v).toBeGreaterThanOrEqual(STAT_MIN);
        expect(v).toBeLessThanOrEqual(STAT_MAX);
      }
      // The role's primary stat is always its highest.
      const role = ROLES[c.role];
      expect(c.stats[role.primary]).toBe(Math.max(power, guard, speed));
    }
  });

  it("rarity never changes the stat budget (rare cards are not strictly stronger)", () => {
    const totals = new Map<string, Set<number>>();
    for (let i = 0; i < 3000; i++) {
      const c = generateCandidate(input(i));
      const cost = c.traits.reduce((s, id) => s + TRAITS_BY_ID.get(id)!.cost, 0);
      const total = c.stats.power + c.stats.guard + c.stats.speed + cost;
      (totals.get(c.rarity) ?? totals.set(c.rarity, new Set()).get(c.rarity)!).add(total);
    }
    for (const set of totals.values()) expect([...set]).toEqual([STAT_BUDGET]);
  });

  it("every element × role combination has at least two compatible traits", () => {
    for (const e of ELEMENT_IDS) for (const r of ROLE_IDS) expect(compatibleTraits(e, r).length).toBeGreaterThanOrEqual(2);
  });
});

describe("seed and digest derivation", () => {
  const base = { rulesetId: "gubbles-v1", playerId: "player-a", qrDigest: hex("q"), utcDay: "2026-09-27", locationCell: "gcpvj0" };

  it("seed is deterministic and sensitive to every input", () => {
    const s = cardSeed(base);
    expect(cardSeed({ ...base })).toBe(s);
    for (const k of Object.keys(base) as (keyof typeof base)[]) {
      expect(cardSeed({ ...base, [k]: `${base[k]}x` })).not.toBe(s);
    }
  });

  it("the next UTC day yields a different seed", () => {
    expect(cardSeed({ ...base, utcDay: "2026-09-28" })).not.toBe(cardSeed(base));
  });

  it("QR digest is keyed (not a bare hash) and stable", () => {
    expect(qrDigest("hello")).toBe(qrDigest("hello"));
    expect(qrDigest("hello")).not.toBe(hex("hello"));
    expect(qrDigest("hello")).not.toBe(qrDigest("Hello"));
    expect(qrDigest("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});
