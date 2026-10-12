import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("independent broadcast approval and private client-to-client LAN sharing", async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    oneContext = await browser.newContext(),
    twoContext = await browser.newContext();
  const host = await hostContext.newPage(),
    one = await oneContext.newPage(),
    two = await twoContext.newPage();
  await host.goto("/#host=e2e-host-only");
  await host
    .getByRole("button", { name: "Connected Devices", exact: true })
    .click();
  const code = await host.locator(".pairing h2").innerText();
  async function pair(page: Page, name: string) {
    await page.goto("/");
    await page.getByLabel("Device name").fill(name);
    await page.getByLabel("Pairing code").fill(code);
    await page
      .getByRole("button", { name: "Request connection", exact: true })
      .click();
    await host
      .locator("article")
      .filter({ hasText: name })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Offline LAN", exact: true })
      .click();
    await expect(page.getByLabel("Send to")).toBeVisible();
  }
  await pair(one, "Phone one");
  await pair(two, "Phone two");
  await host.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await host.getByLabel("Send to").selectOption("*");
  const bytes = Buffer.from("independent recipients");
  await host
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "broadcast.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
  await one.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    one.getByRole("button", { name: "Save file", exact: true }),
  ).toBeVisible();
  await expect(
    two.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  await two.getByRole("button", { name: "Accept", exact: true }).click();
  async function save(page: Page, name: string, expected: Buffer) {
    const card = page.locator("article").filter({ hasText: name });
    await expect(
      card.getByRole("button", { name: "Save file", exact: true }),
    ).toBeVisible();
    const pending = page.waitForEvent("download");
    await card.getByRole("button", { name: "Save file", exact: true }).click();
    expect(await readFile((await (await pending).path())!)).toEqual(expected);
  }
  await save(one, "broadcast.bin", bytes);
  await save(two, "broadcast.bin", bytes);
  await two.getByLabel("Send to").selectOption({ label: "Phone one" });
  const privateBytes = Buffer.from("private through the PC host");
  await two
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "private.bin",
      mimeType: "application/octet-stream",
      buffer: privateBytes,
    });
  await one
    .locator("article")
    .filter({ hasText: "private.bin" })
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await save(one, "private.bin", privateBytes);
  await expect(host.getByText("private.bin", { exact: true })).toHaveCount(0);
  await hostContext.close();
  await oneContext.close();
  await twoContext.close();
});
