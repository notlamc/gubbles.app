import { z } from "zod";
import { GAME } from "./constants";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standard geohash encoding. Precision 6 ≈ 1.2 km × 0.61 km cells. */
export function geohashEncode(lat: number, lon: number, precision: number): string {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = "";
  let bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonMin = mid; } else { ch <<= 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

/** Bounding box and centre of a geohash cell. */
export function geohashDecode(hash: string): { lat: number; lon: number; latErr: number; lonErr: number } {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let even = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error("Invalid geohash");
    for (let b = 4; b >= 0; b--) {
      const bitOn = (idx >> b) & 1;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (bitOn) lonMin = mid; else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitOn) latMin = mid; else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2, latErr: (latMax - latMin) / 2, lonErr: (lonMax - lonMin) / 2 };
}

export function quantizeToCell(lat: number, lon: number): string {
  return geohashEncode(lat, lon, GAME.LOCATION_CELL_PRECISION);
}

/** Human-friendly approximate label for a cell: its centre rounded to ~1 km. Never exact GPS. */
export function describeCell(cell: string): string {
  const { lat, lon } = geohashDecode(cell);
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `≈ ${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew} (≈1 km area)`;
}

/** Client-claimed browser position. Every field is an unverified claim. */
export const LocationClaimSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().positive(),
  timestamp: z.number().int().positive(),
});
export type LocationClaim = z.infer<typeof LocationClaimSchema>;

export type LocationCheck =
  | { ok: true; cell: string; accuracyM: number }
  | { ok: false; code: "LOCATION_INVALID" | "LOCATION_STALE" | "LOCATION_IMPRECISE"; message: string };

/** Validate a location claim against server time and quantize it. The exact point is discarded. */
export function checkLocationClaim(input: unknown, now: number = Date.now()): LocationCheck {
  const parsed = LocationClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "LOCATION_INVALID", message: "Location data was missing or malformed." };
  const c = parsed.data;
  if (c.accuracy > GAME.MAX_LOCATION_ACCURACY_M) {
    return { ok: false, code: "LOCATION_IMPRECISE", message: "Your location fix is too imprecise. Try again with a better signal." };
  }
  if (c.timestamp > now + GAME.MAX_LOCATION_FUTURE_SKEW_MS || now - c.timestamp > GAME.MAX_LOCATION_AGE_MS) {
    return { ok: false, code: "LOCATION_STALE", message: "That location fix is stale. Please share a fresh location." };
  }
  return { ok: true, cell: quantizeToCell(c.latitude, c.longitude), accuracyM: Math.round(c.accuracy) };
}
