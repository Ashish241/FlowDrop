import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
async function controls(page: Page, action = "Send Files") {
  await page.goto("/");
  await page.getByRole("button", { name: action, exact: true }).click();
  await page
    .getByText("Advanced connection diagnostics", { exact: true })
    .click();
  return page.locator("details.advanced > section.panel");
}
test("dedicated website works without any desktop API and stays responsive", async ({
  page,
}) => {
  const localApis: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/"))
      localApis.push(req.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Share files instantly",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "../../.flowdrop/online-home.png",
    fullPage: true,
  });
  await controls(page);
  expect(localApis).toEqual([]);
});
test("standalone website transfers multiple files both ways, text, cancellation and reconnect", async ({
  browser,
}) => {
  const l = await browser.newContext(),
    r = await browser.newContext();
  try {
    await l.addInitScript(() => {
      const send = RTCDataChannel.prototype.send;
      RTCDataChannel.prototype.send = function (data) {
        const flag = window as unknown as { corruptNext?: boolean };
        if (flag.corruptNext && data instanceof ArrayBuffer) {
          const changed = data.slice(0);
          new Uint8Array(changed)[0] ^= 1;
          flag.corruptNext = false;
          return Reflect.apply(send, this, [changed]);
        }
        return Reflect.apply(send, this, [data]);
      };
    });
    const a = await l.newPage(),
      b = await r.newPage();
    const left = await controls(a),
      right = await controls(b, "Receive Files");
    await left
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await expect(left.getByLabel("Room invitation")).toHaveValue(
      /[a-f0-9]{32}/,
    );
    await expect(left.getByTestId("pairing-code")).toHaveText(/[0-9]{6}/);
    await right
      .getByLabel("Room invitation")
      .fill(await left.getByTestId("pairing-code").innerText());
    await right.getByRole("button", { name: "Join room", exact: true }).click();
    await left
      .getByRole("button", { name: "Approve receiver", exact: true })
      .click();
    await expect(right.getByRole("status")).toContainText("Connected.");
    const bytes = [
      Buffer.alloc(2 * 1048576 + 17, 51),
      Buffer.alloc(131089, 99),
    ];
    await left
      .locator("input[type=file]")
      .first()
      .setInputFiles(
        bytes.map((buffer, i) => ({
          name: `online-${i}.bin`,
          mimeType: "application/octet-stream",
          buffer,
        })),
      );
    await left
      .getByRole("button", { name: "Pause transfer", exact: true })
      .click();
    let first = true;
    for (const payload of bytes) {
      const downloaded = b.waitForEvent("download");
      await right
        .getByRole("button", { name: "Accept file", exact: true })
        .click();
      if (first) {
        await expect(left.locator("progress")).toHaveAttribute("value", "0");
        await left
          .getByRole("button", { name: "Resume transfer", exact: true })
          .click();
        first = false;
      }
      expect(await readFile((await (await downloaded).path())!)).toEqual(
        payload,
      );
    }
    const reverse = Buffer.from("standalone website reverse file");
    await right.locator("input[type=file]").first().setInputFiles({
      name: "reverse.txt",
      mimeType: "text/plain",
      buffer: reverse,
    });
    const reverseDownload = a.waitForEvent("download");
    await left
      .getByRole("button", { name: "Accept file", exact: true })
      .click();
    expect(await readFile((await (await reverseDownload).path())!)).toEqual(
      reverse,
    );
    await left
      .getByPlaceholder("Share text with your peer")
      .fill("https://example.com — code and text");
    await left.getByRole("button", { name: "Send text", exact: true }).click();
    await expect(right.locator("pre")).toContainText("code and text");
    await r.grantPermissions(["clipboard-read", "clipboard-write"]);
    await right
      .getByRole("button", { name: "Copy received text", exact: true })
      .click();
    await expect
      .poll(() => b.evaluate(() => navigator.clipboard.readText()))
      .toContain("code and text");
    await right
      .getByRole("button", { name: "Clear received history", exact: true })
      .click();
    await expect(right.locator("pre")).toHaveCount(0);
    await left.getByPlaceholder("Share text with your peer").fill("clear me");
    await left.getByRole("button", { name: "Clear text", exact: true }).click();
    await expect(
      left.getByPlaceholder("Share text with your peer"),
    ).toHaveValue("");

    await left
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "cancel.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.alloc(1024),
      });
    await expect(
      right.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await left
      .getByRole("button", { name: "Cancel transfer", exact: true })
      .click();
    await expect(right.getByRole("status")).toContainText("cancelled");
    await b.reload();
    await b.getByRole("button", { name: "Receive Files", exact: true }).click();
    await b
      .getByText("Advanced connection diagnostics", { exact: true })
      .click();
    await right
      .getByRole("button", { name: "Reconnect saved room", exact: true })
      .click();
    await expect(right.getByRole("status")).toContainText("Connected.");
    await a.evaluate(() => {
      (window as unknown as { corruptNext: boolean }).corruptNext = true;
    });
    await left
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "corrupt.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.alloc(1024, 7),
      });
    const corruptDownload = b.waitForEvent("download");
    await right
      .getByRole("button", { name: "Accept file", exact: true })
      .click();
    await expect(right.getByRole("status")).toContainText(
      "Integrity verification failed",
    );
    expect(await (await corruptDownload).failure()).not.toBeNull();
    await left
      .getByRole("button", { name: "Cancel transfer", exact: true })
      .click();
    await left.getByRole("button", { name: "End room", exact: true }).click();
  } finally {
    for (const context of [l, r])
      for (const page of context.pages())
        await page
          .getByRole("button", { name: "Disconnect", exact: true })
          .click({ timeout: 1000 })
          .catch(() => undefined);
    await Promise.all([l.close(), r.close()]);
  }
});
test("cold-start outage retains files and gives a useful retry", async ({
  page,
}) => {
  await page.route("**/signal/rooms", (route) =>
    route.fulfill({
      status: 503,
      body: JSON.stringify({ detail: "service waking" }),
      contentType: "application/json",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Send Files", exact: true }).click();
  await page
    .getByLabel("Browse Files", { exact: true })
    .setInputFiles({
      name: "retained.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("keep me"),
    });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".flow-error")).toContainText(
    "selected files are retained",
  );
  await expect(
    page.getByRole("list", { name: "Selected files" }),
  ).toContainText("retained.txt");
  await page.unroute("**/signal/rooms");
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(page.locator(".code")).toHaveText(/\d{3} \d{3}/);
  await expect(
    page.getByRole("list", { name: "Selected files" }),
  ).toContainText("retained.txt");
  await page.getByRole("button", { name: "End share", exact: true }).click();
});
