import { describe, expect, it } from "vitest";
import { endOfUtcDay, utcDay } from "@/lib/game/day";

describe("UTC day keys", () => {
  it("rolls over exactly at UTC midnight", () => {
    expect(utcDay(new Date("2026-09-27T23:59:59.999Z"))).toBe("2026-09-27");
    expect(utcDay(new Date("2026-09-28T00:00:00.000Z"))).toBe("2026-09-28");
  });

  it("ignores local time-zone offsets in the input", () => {
    // 01:30 in UTC+02:00 is still the previous UTC day.
    expect(utcDay(new Date("2026-09-28T01:30:00+02:00"))).toBe("2026-09-27");
    expect(utcDay(new Date("2026-09-27T20:00:00-05:00"))).toBe("2026-09-28");
  });

  it("handles month/year boundaries and leap days", () => {
    expect(utcDay(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
    expect(utcDay(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
    expect(utcDay(new Date("2028-02-29T12:00:00Z"))).toBe("2028-02-29");
    expect(endOfUtcDay(new Date("2028-02-29T12:00:00Z")).toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
});
