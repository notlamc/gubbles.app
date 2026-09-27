import { describe, expect, it } from "vitest";
import { decryptAesGcm, deriveKey, encodeFields, encryptAesGcm, randomNumericCode } from "@/lib/security/crypto";

describe("crypto helpers", () => {
  it("length-prefixed encoding is unambiguous", () => {
    expect(encodeFields(["ab", "c"]).equals(encodeFields(["a", "bc"]))).toBe(false);
    expect(encodeFields(["", "x"]).equals(encodeFields(["x", ""]))).toBe(false);
  });

  it("derives distinct domain-separated keys", () => {
    expect(deriveKey("m".repeat(32), "a").equals(deriveKey("m".repeat(32), "b"))).toBe(false);
    expect(deriveKey("m".repeat(32), "a").equals(deriveKey("m".repeat(32), "a"))).toBe(true);
  });

  it("AES-GCM round-trips and detects tampering or wrong AAD", () => {
    const key = deriveKey("k".repeat(32), "test");
    const c = encryptAesGcm(key, "JBSWY3DPEHPK3PXP", "user-1");
    expect(decryptAesGcm(key, c, "user-1")).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptAesGcm(key, c, "user-2")).toThrow();
    const [iv, tag, data] = c.split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptAesGcm(key, [iv, tag, flipped.toString("base64url")].join("."), "user-1")).toThrow();
  });

  it("numeric codes are 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(randomNumericCode()).toMatch(/^\d{6}$/);
  });
});
