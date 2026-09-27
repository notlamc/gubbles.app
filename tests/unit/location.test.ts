import { describe, expect, it } from "vitest";
import { checkLocationClaim, describeCell, geohashDecode, geohashEncode, quantizeToCell } from "@/lib/game/location";
import { GAME } from "@/lib/game/constants";

describe("location quantization", () => {
  it("matches known geohash vectors", () => {
    expect(geohashEncode(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
    expect(geohashEncode(42.6, -5.6, 5)).toBe("ezs42");
  });

  it("uses a neighbourhood-scale cell (precision 6)", () => {
    const cell = quantizeToCell(51.5074, -0.1278);
    expect(cell).toHaveLength(GAME.LOCATION_CELL_PRECISION);
    const { latErr, lonErr } = geohashDecode(cell);
    // ~0.6 km × ~1.2 km cells
    expect(latErr * 2 * 111).toBeLessThan(1);
    expect(lonErr * 2 * 111).toBeLessThan(1.5);
  });

  it("maps nearby points to the same cell and distant points to different cells", () => {
    expect(quantizeToCell(51.50741, -0.12781)).toBe(quantizeToCell(51.50745, -0.12785));
    expect(quantizeToCell(51.5074, -0.1278)).not.toBe(quantizeToCell(51.53, -0.1278));
  });

  it("describes a cell only approximately", () => {
    expect(describeCell(quantizeToCell(51.507412, -0.127812))).toMatch(/^≈ 51\.5\d°N, 0\.1\d°W/);
  });
});

describe("location claim validation", () => {
  const now = Date.UTC(2026, 8, 27, 12);
  const good = { latitude: 10, longitude: 20, accuracy: 50, timestamp: now - 2000 };

  it("accepts a fresh, plausible claim and discards exact coordinates", () => {
    const r = checkLocationClaim(good, now);
    expect(r).toEqual({ ok: true, cell: quantizeToCell(10, 20), accuracyM: 50 });
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(checkLocationClaim({ ...good, latitude: 91 }, now)).toMatchObject({ ok: false, code: "LOCATION_INVALID" });
    expect(checkLocationClaim({ ...good, longitude: -181 }, now)).toMatchObject({ ok: false, code: "LOCATION_INVALID" });
    expect(checkLocationClaim({ ...good, latitude: Number.NaN }, now)).toMatchObject({ ok: false, code: "LOCATION_INVALID" });
    expect(checkLocationClaim({ ...good, latitude: "10" }, now)).toMatchObject({ ok: false, code: "LOCATION_INVALID" });
    expect(checkLocationClaim(null, now)).toMatchObject({ ok: false, code: "LOCATION_INVALID" });
  });

  it("rejects imprecise fixes", () => {
    expect(checkLocationClaim({ ...good, accuracy: GAME.MAX_LOCATION_ACCURACY_M + 1 }, now)).toMatchObject({ code: "LOCATION_IMPRECISE" });
  });

  it("rejects stale and future-dated fixes", () => {
    expect(checkLocationClaim({ ...good, timestamp: now - GAME.MAX_LOCATION_AGE_MS - 1 }, now)).toMatchObject({ code: "LOCATION_STALE" });
    expect(checkLocationClaim({ ...good, timestamp: now + GAME.MAX_LOCATION_FUTURE_SKEW_MS + 1 }, now)).toMatchObject({ code: "LOCATION_STALE" });
  });
});
