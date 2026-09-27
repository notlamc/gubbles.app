import { UPLOAD } from "./constants";

export type NormalizeResult = { ok: true; payload: string } | { ok: false; reason: "EMPTY" | "TOO_LONG" };

/**
 * Conservative QR payload canonicalization: Unicode NFC and trimming surrounding
 * whitespace only. Case, inner whitespace and URL semantics are preserved exactly.
 */
export function normalizeQrPayload(raw: string): NormalizeResult {
  const payload = raw.normalize("NFC").trim();
  if (payload.length === 0) return { ok: false, reason: "EMPTY" };
  if (payload.length > UPLOAD.MAX_QR_PAYLOAD_CHARS) return { ok: false, reason: "TOO_LONG" };
  return { ok: true, payload };
}
