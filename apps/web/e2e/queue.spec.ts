import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("LAN queue automatically recovers stored files after refresh and remains session scoped", async ({
  browser,
  baseURL,
}) => {
  const sender = await browser.newContext(),
    receiver = await browser.newContext();
  const a = await sender.newPage(),
    b = await receiver.newPage();
  const api = baseURL + "/api";
  const host = { Authorization: "Bearer e2e-host-only" };
  const session = await (
    await sender.request.get(api + "/session", { headers: host })
  ).json();
  const pair = await (
    await sender.request.post(api + "/pair", {
      data: { code: session.pairing_code, name: "Queue receiver" },
    })
  ).json();
  await sender.request.post(api + `/devices/${pair.id}/approve`, {
    headers: host,
  });
  await b.addInitScript(
    (token) => sessionStorage.setItem("token", token),
    pair.token,
  );
  await b.goto("/");
  await b.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await a.goto("/#host=e2e-host-only");
  await a.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await a.getByLabel("Send to").selectOption(pair.id);
  const bytes = Buffer.alloc(2 * 1048576 + 33, 91);
  const offered = a.waitForResponse(
    (response) =>
      response.url().endsWith("/api/transfers") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await a.locator("input[type=file]").first().setInputFiles({
    name: "persisted.bin",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await offered;
  await expect(
    a.getByText("Checking SHA-256 before offering persisted.bin", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    b.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  // Refresh before acceptance: the original File must come from scoped IndexedDB, not this test reselecting it.
  await a.reload();
  await a.getByRole("button", { name: "Offline LAN", exact: true }).click();
  let interrupted = false;
  await a.route("**/api/transfers/*/chunks/0", async (route) => {
    if (!interrupted) {
      interrupted = true;
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await b.getByRole("button", { name: "Accept", exact: true }).click();
  await a
    .getByRole("button", { name: "Retry queued file", exact: true })
    .click();
  await expect(
    b.getByRole("button", { name: "Save file", exact: true }),
  ).toBeVisible();
  const downloading = b.waitForEvent("download");
  await b.getByRole("button", { name: "Save file", exact: true }).click();
  expect(await readFile((await (await downloading).path())!)).toEqual(bytes);
  await a.getByRole("button", { name: "Settings", exact: true }).click();
  await a
    .getByRole("button", { name: "Disconnect this browser", exact: true })
    .click();
  await a
    .getByRole("button", { name: "Transfer Dashboard", exact: true })
    .click();
  await expect(a.getByText("persisted.bin", { exact: true })).toHaveCount(0);
  await sender.close();
  await receiver.close();
});
