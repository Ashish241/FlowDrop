import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("LAN approval, binary file, and text across isolated browser contexts", async ({
  browser,
}) => {
  const host = await browser.newContext(),
    client = await browser.newContext();
  const a = await host.newPage(),
    b = await client.newPage();
  await a.goto("/#host=e2e-host-only");
  await a
    .getByRole("button", { name: "Connected Devices", exact: true })
    .click();
  const code = await a.locator(".pairing h2").innerText();
  await b.goto("/");
  await b.getByLabel("Device name").fill("Test phone");
  await b.getByLabel("Pairing code").fill(code);
  await b
    .getByRole("button", { name: "Request connection", exact: true })
    .click();
  await a.getByRole("button", { name: "Approve", exact: true }).click();
  await b.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await expect(b.getByLabel("Send to")).toBeVisible();
  await a.getByRole("button", { name: "Offline LAN", exact: true }).click();
  await a.getByLabel("Send to").selectOption({ label: "Test phone" });
  const bytes = Buffer.from([0, 1, 2, 255, 128, 10]);
  await a.locator("input[type=file]").first().setInputFiles({
    name: "unicode-こんにちは.bin",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await b.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Save file", exact: true }),
  ).toBeVisible();
  await expect(b.getByText(/SHA-256 verified/)).toBeVisible();
  const downloading = b.waitForEvent("download");
  await b.getByRole("button", { name: "Save file", exact: true }).click();
  const download = await downloading;
  expect(await readFile((await download.path())!)).toEqual(bytes);
  await b
    .getByRole("button", { name: "I checked the saved file", exact: true })
    .click();
  await expect(b.getByText("Receiver reported: saved")).toBeVisible();
  await a.getByRole("button", { name: "Share Text", exact: true }).click();
  await b.getByRole("button", { name: "Share Text", exact: true }).click();
  await a.locator("select").selectOption({ label: "Test phone" });
  await a.locator("textarea").fill("hello <script> safe");
  await a.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(b.locator("pre")).toContainText("hello <script> safe");
  await host.close();
  await client.close();
});
test("real WebRTC DataChannel approval, file integrity, and text", async ({
  browser,
}) => {
  const left = await browser.newContext(),
    right = await browser.newContext();
  const a = await left.newPage(),
    b = await right.newPage();
  for (const page of [a, b]) {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Online Share", exact: true })
      .click();
  }
  await a.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(a.getByLabel("Room invitation")).toHaveValue(/[a-f0-9]{32}/);
  const room = await a.getByLabel("Room invitation").inputValue();
  await b.getByLabel("Room invitation").fill(room);
  await b.getByRole("button", { name: "Join room", exact: true }).click();
  await a
    .getByRole("button", { name: "Approve receiver", exact: true })
    .click();
  await expect(a.getByRole("status")).toContainText("Connected.");
  await expect(b.getByRole("status")).toContainText("Connected.");
  const bytes = Buffer.alloc(2 * 1048576 + 17, 173);
  await a.locator("input[type=file]").setInputFiles({
    name: "p2p.bin",
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  const downloading = b.waitForEvent("download");
  await b.getByRole("button", { name: "Accept file", exact: true }).click();
  await expect(b.getByRole("status")).toContainText("SHA-256 verified", {
    timeout: 20000,
  });
  const download = await downloading;
  expect(await readFile((await download.path())!)).toEqual(bytes);
  const reverse = Buffer.alloc(131089, 39);
  await b
    .locator("input[type=file]")
    .setInputFiles({
      name: "reverse.bin",
      mimeType: "application/octet-stream",
      buffer: reverse,
    });
  const reverseDownload = a.waitForEvent("download");
  await a.getByRole("button", { name: "Accept file", exact: true }).click();
  expect(await readFile((await (await reverseDownload).path())!)).toEqual(
    reverse,
  );
  await expect(a.getByAltText("Scan online room invitation")).toBeVisible();
  await expect(a.getByRole("link", { name: /#online-room=/ })).toHaveAttribute(
    "href",
    new RegExp("#online-room=" + room + "$"),
  );
  await a.getByPlaceholder("Share text with your peer").fill("WebRTC message");
  await a.locator("input[type=file]").setInputFiles({
    name: "empty.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(0),
  });
  const emptyDownloading = b.waitForEvent("download");
  await b.getByRole("button", { name: "Accept file", exact: true }).click();
  await expect(b.getByRole("status")).toContainText("SHA-256 verified");
  const emptyDownload = await emptyDownloading;
  expect((await readFile((await emptyDownload.path())!)).length).toBe(0);
  await a.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(b.locator("pre")).toContainText("WebRTC message");
  await a.getByRole("button", { name: "Home", exact: true }).click();
  await a.getByRole("button", { name: "Online Share", exact: true }).click();
  await a
    .getByPlaceholder("Share text with your peer")
    .fill("navigation survives");
  await a.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(b.locator("pre").first()).toContainText("navigation survives");
  await b.reload();
  await b.getByRole("button", { name: "Online Share", exact: true }).click();
  await b
    .getByRole("button", { name: "Reconnect saved room", exact: true })
    .click();
  await expect(b.getByRole("status")).toContainText("Connected.");
  await a.getByPlaceholder("Share text with your peer").fill("rejoined peer");
  await a.getByRole("button", { name: "Send text", exact: true }).click();
  await expect(b.locator("pre")).toContainText("rejoined peer");
  await a.locator("input[type=file]").setInputFiles({
    name: "cancel.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(131073, 11),
  });
  await expect(
    b.getByRole("button", { name: "Accept file", exact: true }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Cancel transfer", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Accept file", exact: true }),
  ).toHaveCount(0);
  await a.locator("input[type=file]").setInputFiles({
    name: "pending-after-refresh.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(262145, 37),
  });
  await expect(
    b.getByRole("button", { name: "Accept file", exact: true }),
  ).toBeVisible();
  await a.reload();
  await a.getByRole("button", { name: "Online Share", exact: true }).click();
  await a
    .getByRole("button", { name: "Reconnect saved room", exact: true })
    .click();
  await expect(a.getByRole("status")).toContainText("Connected.");
  await a
    .getByRole("button", { name: "Resume pending sends", exact: true })
    .click();
  const resumed = b.waitForEvent("download");
  await b.getByRole("button", { name: "Accept file", exact: true }).click();
  expect(await readFile((await (await resumed).path())!)).toEqual(
    Buffer.alloc(262145, 37),
  );
  await a.getByRole("button", { name: "End room", exact: true }).click();
  await expect(b.getByRole("status")).toContainText("Room expired or revoked");
  await left.close();
  await right.close();
});
test("Send Later browser encryption, secret link, download, and revocation", async ({
  browser,
}) => {
  const sender = await browser.newContext(),
    receiver = await browser.newContext();
  const a = await sender.newPage(),
    b = await receiver.newPage();
  await a.goto("/");
  await a.getByRole("button", { name: "Send Later", exact: true }).click();
  const data = Buffer.from("encrypted at the sender · こんにちは");
  await a
    .locator("input[type=file]")
    .setInputFiles({ name: "later.txt", mimeType: "text/plain", buffer: data });
  await a
    .getByRole("button", { name: "Encrypt & upload", exact: true })
    .click();
  await expect(
    a.getByLabel("Secret sharing link (anyone with it can decrypt)"),
  ).toBeVisible();
  const link = await a
    .getByLabel("Secret sharing link (anyone with it can decrypt)")
    .inputValue();
  await a.reload();
  await a.getByRole("button", { name: "Send Later", exact: true }).click();
  await expect(
    a.getByLabel("Secret sharing link (anyone with it can decrypt)"),
  ).toHaveValue(link);
  await a
    .getByRole("button", { name: "Transfer Dashboard", exact: true })
    .click();
  await expect(
    a.getByRole("heading", { name: "Online and encrypted transfer history" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Send Later", exact: true }).click();
  await b.goto("/");
  await b.getByRole("button", { name: "Send Later", exact: true }).click();
  await b.getByLabel("Paste secret sharing link").fill(link);
  const downloading = b.waitForEvent("download");
  await b.getByRole("button", { name: "Decrypt & save", exact: true }).click();
  const download = await downloading;
  expect(await readFile((await download.path())!)).toEqual(data);
  await expect(b.getByRole("status")).toContainText("authenticated all chunks");
  await a.getByRole("button", { name: "Revoke share", exact: true }).click();
  await expect(a.getByRole("status")).toContainText("Revoked");
  await b.getByRole("button", { name: "Decrypt & save", exact: true }).click();
  await expect(b.getByRole("status")).toContainText("Share unavailable");
  await sender.close();
  await receiver.close();
});
test("interrupted encrypted upload resumes after refresh and refuses a changed file", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Send Later", exact: true }).click();
  let interruptionPhase = 0;
  await page.route("**/cloud/shares/*/chunks/1", async (route) => {
    if (interruptionPhase === 0) {
      interruptionPhase++;
      await route.abort("connectionfailed");
    } else if (interruptionPhase === 1) {
      interruptionPhase++;
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "1" },
        body: JSON.stringify({ detail: "Busy; retry safely" }),
      });
    } else await route.continue();
  });
  const file = {
    name: "resume.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(1048593, 42),
  };
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("button", { name: "Encrypt & upload", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Failed to fetch");
  await page.reload();
  await page.getByRole("button", { name: "Send Later", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Encrypt & upload", exact: true }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]")
    .setInputFiles({ ...file, buffer: Buffer.alloc(1048593, 43) });
  await page
    .getByRole("button", { name: "Encrypt & upload", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("original file");
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("button", { name: "Encrypt & upload", exact: true })
    .click();
  await expect(
    page.getByLabel("Secret sharing link (anyone with it can decrypt)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revoke share", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Revoked");
});
for (const width of [360, 390, 768, 1024, 1440])
  test(`responsive layout ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#host=e2e-host-only");
    await expect(page.getByLabel("Send to")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
