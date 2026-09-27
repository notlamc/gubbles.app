import { describe, expect, it } from "vitest";
import { normalizeQrPayload } from "@/lib/game/qr";
import { UPLOAD } from "@/lib/game/constants";

describe("QR payload canonicalization", () => {
  it("trims surrounding whitespace only", () => {
    expect(normalizeQrPayload("  hello world \n")).toEqual({ ok: true, payload: "hello world" });
  });

  it("preserves case and inner whitespace", () => {
    expect(normalizeQrPayload("HTTPS://Example.com/A  B")).toEqual({ ok: true, payload: "HTTPS://Example.com/A  B" });
  });

  it("does not alter URL semantics (query, fragment, trailing slash, encoding)", () => {
    const url = "https://example.com/path/?q=A%20b&x=1#Frag";
    expect(normalizeQrPayload(url)).toEqual({ ok: true, payload: url });
    expect(normalizeQrPayload("https://example.com/")).not.toEqual(normalizeQrPayload("https://example.com"));
  });

  it("applies Unicode NFC so composed/decomposed forms match", () => {
    const composed = "café";
    const decomposed = "café";
    expect(normalizeQrPayload(decomposed)).toEqual(normalizeQrPayload(composed));
  });

  it("rejects empty and over-long payloads", () => {
    expect(normalizeQrPayload("   ")).toEqual({ ok: false, reason: "EMPTY" });
    expect(normalizeQrPayload("x".repeat(UPLOAD.MAX_QR_PAYLOAD_CHARS))).toMatchObject({ ok: true });
    expect(normalizeQrPayload("x".repeat(UPLOAD.MAX_QR_PAYLOAD_CHARS + 1))).toEqual({ ok: false, reason: "TOO_LONG" });
  });
});
