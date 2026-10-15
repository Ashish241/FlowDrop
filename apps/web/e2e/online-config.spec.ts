import { test, expect } from "@playwright/test";

test("desktop without signaling never tries LAN signaling or advertises working rooms", async ({
  page,
}) => {
  let signalingCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/signal/")) signalingCalls++;
  });
  await page.route("**/api/online/config", (route) =>
    route.fulfill({
      json: {
        mode: "desktop",
        available: false,
        message:
          "Online Sharing is unavailable: signaling server not configured.",
        website: "",
        signaling: "",
      },
    }),
  );
  await page.goto("/#host=e2e-host-only");
  await page.getByRole("button", { name: "Online Share", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Online Sharing is unavailable: signaling server not configured.",
  );
  await expect(
    page.getByRole("button", { name: "Create room", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Public FlowDrop website URL")).toBeVisible();
  expect(signalingCalls).toBe(0);
});

test("configured desktop hands off to HTTPS site without exposing LAN credentials", async ({
  page,
}) => {
  await page.route("**/api/online/config", (route) =>
    route.fulfill({
      json: {
        mode: "desktop",
        available: true,
        message: "Hosted online service is reachable.",
        website: "https://share.example.com",
        signaling: "https://share.example.com/signal",
      },
    }),
  );
  await page.goto("/#host=e2e-host-only");
  await page.getByRole("button", { name: "Online Share", exact: true }).click();
  const link = page.getByRole("link", { name: "Open hosted Online Share" });
  await expect(link).toHaveAttribute(
    "href",
    "https://share.example.com/#online=1",
  );
  await expect(link).toHaveAttribute("rel", "noreferrer");
  expect(await link.getAttribute("href")).not.toContain("e2e-host-only");
  await expect(
    page.getByRole("button", { name: "Create room", exact: true }),
  ).toHaveCount(0);
});

test("hosted signaling outage is visible before room creation", async ({
  page,
}) => {
  await page.route("**/signal/health", (route) =>
    route.fulfill({ status: 503, json: { detail: "unavailable" } }),
  );
  await page.goto("/#online=1");
  await expect(page.getByRole("status")).toContainText(
    "signaling service health check failed (503)",
  );
  await expect(
    page.getByRole("button", { name: "Create room", exact: true }),
  ).toHaveCount(0);
});

test("relay-only never silently falls back when TURN is missing", async ({
  page,
}) => {
  await page.goto("/#online=1");
  await page.getByRole("checkbox", { name: /Relay-only/ }).check();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Relay-only testing requires configured authenticated TURN servers",
  );
});
