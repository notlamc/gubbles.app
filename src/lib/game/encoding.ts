/**
 * Unambiguous, versioned encoding for hash/HMAC inputs: each field is
 * length-prefixed (u32 BE) so ("ab","c") and ("a","bc") can never collide.
 */
export function encodeFields(fields: readonly string[]): Buffer {
  const parts: Buffer[] = [];
  for (const f of fields) {
    const b = Buffer.from(f, "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(b.length);
    parts.push(len, b);
  }
  return Buffer.concat(parts);
}
