/** Explicit UTC calendar day key, e.g. "2026-09-27". The server clock is authoritative. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The instant the given UTC day ends (next UTC midnight). */
export function endOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}
