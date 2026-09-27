import "server-only";
import { env } from "@/lib/env";
import { deriveKey, encodeFields, hmacHex } from "@/lib/security/crypto";

let qrKey: Buffer | null = null;
let seedKey: Buffer | null = null;

function keys() {
  // Domain-separated subkeys of one stable master secret.
  qrKey ??= deriveKey(env().GAME_HMAC_SECRET, "qr-digest/v1");
  seedKey ??= deriveKey(env().GAME_HMAC_SECRET, "card-seed/v1");
  return { qrKey, seedKey };
}

/** Persistent identity of a QR payload. The raw payload is never stored. */
export function qrDigest(normalizedPayload: string): string {
  return hmacHex(keys().qrKey, encodeFields(["gubbles-qr", "v1", normalizedPayload]));
}

export function cardSeed(input: {
  rulesetId: string;
  playerId: string;
  qrDigest: string;
  utcDay: string;
  locationCell: string;
}): string {
  return hmacHex(
    keys().seedKey,
    encodeFields(["gubbles-card-seed", "v1", input.rulesetId, input.playerId, input.qrDigest, input.utcDay, input.locationCell]),
  );
}
