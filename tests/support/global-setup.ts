import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Build a disposable SQLite database for the integration tests. */
export default function setup() {
  const root = path.resolve(__dirname, "../..");
  for (const f of ["prisma/test.db", "prisma/test.db-journal"]) rmSync(path.join(root, f), { force: true });
  rmSync(path.join(root, ".data/test-assets"), { recursive: true, force: true });
  execSync("npx prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  return () => {
    for (const f of ["prisma/test.db", "prisma/test.db-journal"]) rmSync(path.join(root, f), { force: true });
  };
}
