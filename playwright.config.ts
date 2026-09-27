import { defineConfig, devices } from "@playwright/test";

export const E2E_PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Mocked geolocation for the discovery flow.
    geolocation: { latitude: 48.8566, longitude: 2.3522, accuracy: 25 },
    permissions: ["geolocation"],
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
});
