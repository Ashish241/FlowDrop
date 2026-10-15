import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testIgnore: ["**/*-product.spec.ts", "**/consumer-online.spec.ts"],
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8765",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m scripts.e2e_host",
    cwd: "../..",
    url: "http://127.0.0.1:8765/api/health",
    reuseExistingServer: false,
  },
});
