/**
 * Standalone artwork worker: drains due artwork jobs (including scheduled retries
 * and jobs whose worker crashed). Run alongside `next dev`/`next start`:
 *   npm run worker
 * Mint requests also process their own job right after the response, so the
 * worker is a durability backstop rather than a requirement for local play.
 */
import { processDueArtworkJobs } from "../src/lib/artwork/jobs";

const INTERVAL_MS = 3_000;
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function loop() {
  console.log("[gubbles:worker] artwork worker started");
  while (!stopping) {
    try {
      const ran = await processDueArtworkJobs({ limit: 5 });
      if (ran) console.log(`[gubbles:worker] processed ${ran} job(s)`);
    } catch (err) {
      console.error("[gubbles:worker] error", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.log("[gubbles:worker] stopped");
  process.exit(0);
}

void loop();
