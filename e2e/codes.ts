import { readFileSync } from "node:fs";
import path from "node:path";

const LOG = path.resolve(__dirname, "..", ".data", "e2e-server.log");

/** Read the most recent console-delivered code for a destination + purpose from the server log. */
export async function readCode(destination: string, purpose: string, after = 0): Promise<string> {
  const deadline = Date.now() + 15_000;
  const re = /\[gubbles:dev-delivery\] channel=\S+ to=(\S+) purpose=(\S+) code=(\d{6})/g;
  for (;;) {
    const text = readFileSync(LOG, "utf8").slice(after);
    let found: string | null = null;
    for (const m of text.matchAll(re)) if (m[1] === destination && m[2] === purpose) found = m[3]!;
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`no ${purpose} code for ${destination} in server log`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export function logSize(): number {
  return readFileSync(LOG, "utf8").length;
}
