import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "rooms.spec.ts",
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  outputDir: "../../.flowdrop/post-connection-dev",
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "python -m uvicorn services.signaling.app:create_app --factory --host 127.0.0.1 --port 8772 --no-access-log",
      cwd: "../..",
      env: { FLOWDROP_ORIGINS: "http://127.0.0.1:5174" },
      url: "http://127.0.0.1:8772/health",
      reuseExistingServer: false,
    },
    {
      command: "npx vite --config vite.dev-test.config.ts --mode online",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
    },
  ],
});
