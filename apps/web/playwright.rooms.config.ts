import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: [
    "rooms.spec.ts",
    "workspace.spec.ts",
    "integration-product.spec.ts",
  ],
  workers: 1,
  outputDir: "../../.flowdrop/rooms-browser-results",
  timeout: 120000,
  expect: { timeout: 30000 },
  use: {
    baseURL: process.env.FLOWDROP_PUBLIC_URL || "http://127.0.0.1:8770",
    trace: "retain-on-failure",
  },
  webServer: process.env.FLOWDROP_PUBLIC_URL
    ? undefined
    : {
        command: "python -m scripts.product_host online",
        cwd: "../..",
        url: "http://127.0.0.1:8770/",
        reuseExistingServer: false,
      },
});
