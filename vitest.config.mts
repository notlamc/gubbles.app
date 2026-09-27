import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside React Server Components; services are plain Node in tests.
      "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      APP_ORIGIN: "http://localhost:3000",
      GAME_HMAC_SECRET: "test-game-secret-0123456789abcdef0123456789",
      AUTH_HMAC_SECRET: "test-auth-secret-0123456789abcdef0123456789",
      TOTP_ENCRYPTION_KEY_V1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
      TOTP_KEY_VERSION: "1",
      DELIVERY_PROVIDER: "console",
      ARTWORK_PROVIDER: "stub",
      ASSET_STORAGE_DIR: "./.data/test-assets",
    },
  },
});
