import { describe, expect, it } from "vitest";
import { assertSameOrigin, CSRF_HEADER } from "@/lib/security/request";

const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api/v1/x", { method: "POST", headers });

describe("CSRF origin guard", () => {
  it("accepts same-origin requests carrying the verification header", () => {
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000", [CSRF_HEADER]: "1" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ referer: "http://localhost:3000/play", [CSRF_HEADER]: "1" }))).not.toThrow();
  });

  it("rejects cross-origin, missing origin, and missing header", () => {
    expect(() => assertSameOrigin(req({ origin: "https://evil.example", [CSRF_HEADER]: "1" }))).toThrow(/did not come from/);
    expect(() => assertSameOrigin(req({ [CSRF_HEADER]: "1" }))).toThrow();
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000" }))).toThrow(/header/);
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000.evil.example", [CSRF_HEADER]: "1" }))).toThrow();
  });
});
