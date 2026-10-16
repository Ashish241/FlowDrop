import { defineConfig } from "@playwright/test";
// Explicit opt-in: these tests create temporary rooms on the real deployment.
if (process.env.FLOWDROP_PUBLIC_URL !== "https://flowdrop-online.pages.dev")
  throw new Error(
    "Set FLOWDROP_PUBLIC_URL to the authorized production website",
  );
export default defineConfig({
  testDir: "e2e",
  testMatch: [
    "rooms.spec.ts",
    "workspace.spec.ts",
    "integration-product.spec.ts",
  ],
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  outputDir: "../../.flowdrop/tests-public-041",
  use: {
    baseURL: process.env.FLOWDROP_PUBLIC_URL,
    headless: true,
    trace: "retain-on-failure",
  },
});
