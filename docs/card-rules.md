# Card rules — ruleset `gubbles-v1`

Source of truth: `src/lib/game/catalogue.ts` and `src/lib/game/generate.ts`. A golden test vector
(`tests/unit/generate.test.ts`) fails if output for fixed inputs changes; any change to rules or
catalogue ordering/weights requires a new `RULESET_ID`.

## Inputs
| Input | Source |
|---|---|
| QR digest | HMAC-SHA256(HKDF(GAME_HMAC_SECRET, "qr-digest/v1"), normalized payload) |
| UTC day | server clock, `YYYY-MM-DD` |
| Location cell | geohash precision 6 (~1.2 × 0.6 km) of the client's claim |
| Player ID | authenticated user |
| Seed | HMAC-SHA256(HKDF(secret, "card-seed/v1"), length-prefixed [ruleset, player, digest, day, cell]) |

## Mapping layers (each a domain-separated HMAC-SHA256 counter-mode stream)
1. **Family** ← digest only. A code always hides the same family, for everyone, every day.
2. **Role** ← digest + day, from the family's two allowed roles.
3. **Element, variant, rarity** ← digest + day + cell. Native element weighted 5, others 2.
   Rarity weights: common 600, uncommon 250, rare 100, epic 40, mythic 10.
4. **Personal** ← full seed: two distinct compatible traits, stat split, flavour line, art details,
   4-hex signature.

Location only nudges element/look/rarity; no ability requires a real-world place.

## Balance
- Every card has the same 150-point budget; each trait spends its cost (0–5) from it.
- Role share ranges (percent of budget): primary 40–50, secondary 24–34, tertiary 20–30.
  The primary stat is always the highest. Stats stay within 15–80.
- **Rarity never changes the budget** — it only changes frame, glow and foil.
- Traits are compatible when their element list is empty or contains the card's element, and their
  role list is empty or contains the role. Every element × role pair has ≥ 2 compatible traits.
- Trait effects are descriptive only. Battles, weakness/resistance and trading are not implemented.

## Catalogue v1
Families: Ripplekin (tide), Flurri (gale), Brimmo (ember), Mosslet (grove), Shardling (ember),
Nyxen (gale). Elements: Tide, Gale, Ember, Grove. Roles: Striker (Power), Warden (Guard),
Skirmisher (Speed). Variants: Dawn, Dusk, Moonlit, Speckled, Banded, Starry.
