import { defineConfig } from "@playwright/test";
const selected = process.argv
  .find(
    (arg) =>
      arg === "desktop" || arg === "online" || arg.startsWith("--project="),
  )
  ?.replace("--project=", "");
export default defineConfig({
  testDir: "e2e",
  timeout: 90000,
  workers: 1,
  use: { headless: true, trace: "retain-on-failure" },
  projects: [
    {
      name: "online",
      testMatch: ["online-product.spec.ts", "integration-product.spec.ts"],
      use: { baseURL: "http://127.0.0.1:8770" },
    },
    {
      name: "desktop",
      testMatch: [
        "desktop-product.spec.ts",
        "integration-product.spec.ts",
        "queue.spec.ts",
        "lan-url.spec.ts",
        "multi-device.spec.ts",
      ],
      use: { baseURL: "http://127.0.0.1:8771" },
    },
  ],
  webServer: [
    {
      command: "python -m scripts.product_host online",
      cwd: "../..",
      url: "http://127.0.0.1:8770/",
      reuseExistingServer: false,
    },
    {
      command: "python -m scripts.product_host desktop",
      cwd: "../..",
      url: "http://127.0.0.1:8771/",
      reuseExistingServer: false,
    },
  ].filter((server) => !selected || server.command.endsWith(selected)),
});
