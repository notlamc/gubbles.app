import { createHmac } from "node:crypto";

/**
 * Deterministic PRNG: HMAC-SHA256 in counter mode keyed by seed bytes and a
 * domain label. Portable (any platform with HMAC-SHA256 reproduces it) and
 * independent of Math.random(). Never use Math.random() for card generation.
 */
export class DeterministicRng {
  private counter = 0;
  private buffer: Buffer = Buffer.alloc(0);
  private offset = 0;

  constructor(private readonly key: Buffer, private readonly domain: string) {}

  private refill() {
    const msg = Buffer.alloc(4);
    msg.writeUInt32BE(this.counter++);
    this.buffer = createHmac("sha256", this.key).update(this.domain).update("\u0000").update(msg).digest();
    this.offset = 0;
  }

  /** Next unsigned 32-bit integer. */
  nextUint32(): number {
    if (this.offset + 4 > this.buffer.length) this.refill();
    const v = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return v;
  }

  /** Unbiased integer in [0, n). */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 0x1_0000_0000) throw new Error("int(n) requires 0 < n <= 2^32");
    const ceiling = Math.floor(0x1_0000_0000 / n) * n;
    for (;;) {
      const v = this.nextUint32();
      if (v < ceiling) return v % n;
    }
  }

  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() on empty list");
    return items[this.int(items.length)] as T;
  }

  /** Weighted choice over integer weights. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.int(total);
    for (const [item, w] of entries) {
      if (r < w) return item;
      r -= w;
    }
    throw new Error("unreachable");
  }
}
