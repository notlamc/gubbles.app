import { spawn, execSync, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = 3100;
const root = path.resolve(__dirname, "..");
export const SERVER_LOG = path.join(root, ".data", "e2e-server.log");

/**
 * Boots an isolated dev server (own SQLite DB, asset dir and .next dir) and captures its
 * stdout, so tests can read console-delivered verification codes exactly as a developer would.
 */
export default async function globalSetup() {
  mkdirSync(path.join(root, ".data"), { recursive: true });
  for (const f of ["prisma/e2e.db", "prisma/e2e.db-journal"]) rmSync(path.join(root, f), { force: true });
  rmSync(path.join(root, ".data/e2e-assets"), { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development" as const,
    DATABASE_URL: "file:./e2e.db",
    APP_ORIGIN: `http://localhost:${PORT}`,
    ASSET_STORAGE_DIR: "./.data/e2e-assets",
    ARTWORK_PROVIDER: "stub",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "pipe" });

  const log = createWriteStream(SERVER_LOG, { flags: "w" });
  const child: ChildProcess = spawn("npx", ["next", "dev", "-p", String(PORT)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error("e2e server did not start; see .data/e2e-server.log");
    await new Promise((r) => setTimeout(r, 1000));
  }

  return async () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {}
  };
}
