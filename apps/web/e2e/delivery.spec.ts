import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function enter(page: Page, name: string, code?: string) {
  await page.goto(code ? "/#room=" + code : "/");
  if (!code)
    await page
      .getByRole("button", { name: "Create Room", exact: true })
      .click();
  await page.getByLabel("Device name", { exact: true }).fill(name);
  await page
    .getByRole("button", {
      name: code ? "Join Room" : "Create Room",
      exact: true,
    })
    .last()
    .click();
  await expect(page.getByTestId("room-code")).toHaveText(/\d{6}/);
  return (await page.getByTestId("room-code").innerText()).trim();
}
test("auto-selection preserves choices; partial success retries only unfinished recipients and clears verified attachments", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  try {
    for (const ctx of contexts)
      await ctx.addInitScript(() => {
        const state = {
          offers: 0,
          channels: [] as RTCDataChannel[],
          sockets: [] as WebSocket[],
        };
        Object.assign(window, { deliveryTest: state });
        const observe = (dc: RTCDataChannel) => {
          state.channels.push(dc);
          dc.addEventListener("message", (event) => {
            if (
              typeof event.data === "string" &&
              JSON.parse(event.data).type === "file"
            )
              state.offers++;
          });
        };
        const PC = RTCPeerConnection;
        window.RTCPeerConnection = class extends PC {
          constructor(config?: RTCConfiguration) {
            super(config);
            this.addEventListener("datachannel", (event) =>
              observe(event.channel),
            );
          }
          createDataChannel(label: string, options?: RTCDataChannelInit) {
            const dc = super.createDataChannel(label, options);
            observe(dc);
            return dc;
          }
        };
        const WS = WebSocket;
        window.WebSocket = class extends WS {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            state.sockets.push(this);
          }
        };
      });
    const [a, b, c, d] = await Promise.all(
      contexts.map((ctx) => ctx.newPage()),
    );
    const code = await enter(a, "Sender");
    await enter(b, "Phone", code);
    await expect(
      a.getByRole("checkbox", { name: "Select Phone", exact: true }),
    ).toBeChecked();
    await expect(
      a.getByRole("checkbox", { name: "Select Sender", exact: true }),
    ).toHaveCount(0);
    await a
      .getByRole("checkbox", { name: "Select Phone", exact: true })
      .uncheck();
    await expect(
      b.getByRole("checkbox", { name: "Select Sender", exact: true }),
    ).toBeChecked();
    await a.evaluate(() =>
      (
        window as unknown as { deliveryTest: { sockets: WebSocket[] } }
      ).deliveryTest.sockets
        .at(-1)
        ?.close(),
    );
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await expect(
      a.getByRole("checkbox", { name: "Select Phone", exact: true }),
    ).not.toBeChecked();
    await enter(c, "Tablet", code);
    await expect(
      a.getByRole("checkbox", { name: "Select Tablet", exact: true }),
    ).toBeChecked();
    await expect(
      a.getByRole("checkbox", { name: "Select Phone", exact: true }),
    ).not.toBeChecked();
    await a
      .getByRole("button", { name: "Clear Selection", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Edit device name", exact: true })
      .click();
    await b.getByLabel("New device name").fill("Renamed phone");
    await b.getByRole("button", { name: "Save name", exact: true }).click();
    await expect(
      a.getByRole("checkbox", { name: "Select Renamed phone", exact: true }),
    ).not.toBeChecked();
    await a.getByRole("button", { name: "Select All", exact: true }).click();
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    const bytes = Buffer.alloc(262163, 47);
    await a.getByLabel("Choose files", { exact: true }).setInputFiles({
      name: "persist.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await a
      .getByRole("button", { name: "Send to Selected Devices", exact: true })
      .click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(a.locator(".attachment")).toHaveCount(1);
    await a
      .getByRole("button", { name: "Send to Selected Devices", exact: true })
      .click();
    await enter(d, "Late device", code);
    await expect(
      a.getByRole("checkbox", { name: "Select Late device", exact: true }),
    ).toBeChecked();
    await expect(
      d.getByRole("button", { name: "Accept file", exact: true }),
    ).toHaveCount(0);
    let received = 0;
    b.on("download", () => received++);
    const download = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await download).path())!)).toEqual(bytes);
    const summary = a
      .locator(".delivery-summary")
      .filter({ hasText: "persist.bin" });
    await expect(summary).toContainText("Renamed phone — Verified");
    await expect(a.locator(".attachment")).toHaveCount(1);
    await c.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(summary).toContainText("Tablet — Declined");
    await expect(a.locator(".attachment")).toHaveCount(1);
    await summary
      .getByRole("button", {
        name: "Hide completed Renamed phone",
        exact: true,
      })
      .click();
    await summary.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await c.evaluate(() => {
      for (const channel of (
        window as unknown as { deliveryTest: { channels: RTCDataChannel[] } }
      ).deliveryTest.channels)
        channel.close();
    });
    await expect(summary).toContainText("Tablet — Failed");
    await expect(a.locator(".attachment")).toHaveCount(1);
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await summary.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    const retried = c.waitForEvent("download");
    await c.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await retried).path())!)).toEqual(bytes);
    await expect(a.locator(".attachment")).toHaveCount(0);
    await expect(summary.locator("summary")).toContainText("Verified ✓");
    expect(received).toBe(1);
    expect(
      await b.evaluate(
        () =>
          (window as unknown as { deliveryTest: { offers: number } })
            .deliveryTest.offers,
      ),
    ).toBe(1);
    expect(
      await d.evaluate(
        () =>
          (window as unknown as { deliveryTest: { offers: number } })
            .deliveryTest.offers,
      ),
    ).toBe(0);
    await d.getByRole("button", { name: "Leave Room", exact: true }).click();
    await expect(d.locator(".home-actions button")).toHaveCount(4);
    await expect(
      a.getByRole("checkbox", { name: "Select Late device", exact: true }),
    ).toHaveCount(0);
    await a
      .getByRole("button", { name: "Clear Selection", exact: true })
      .click();
    await enter(d, "Rejoined device", code);
    await expect(
      a.getByRole("checkbox", { name: "Select Rejoined device", exact: true }),
    ).toBeChecked();
    await expect(
      a.getByRole("checkbox", { name: "Select Renamed phone", exact: true }),
    ).not.toBeChecked();
    await expect(
      d.getByRole("button", { name: "Accept file", exact: true }),
    ).toHaveCount(0);
    await a.screenshot({
      path: "../../.flowdrop/delivery-verified.png",
      fullPage: true,
    });
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});

test("batch attachments clear individually only after receiver verification", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    const code = await enter(a, "Batch sender");
    await enter(b, "Batch receiver", code);
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await a.getByLabel("Choose files", { exact: true }).setInputFiles([
      {
        name: "one.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([1, 2, 3]),
      },
      {
        name: "two.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([4, 5, 6, 7]),
      },
    ]);
    await a
      .getByRole("button", { name: "Send to Selected Devices", exact: true })
      .click();
    const first = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await first).path())!)).toEqual(
      Buffer.from([1, 2, 3]),
    );
    await expect(a.locator(".attachment")).toHaveCount(1);
    await expect(a.locator(".attachment")).toContainText("two.bin");
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Send to Selected Devices", exact: true })
      .click();
    const second = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await second).path())!)).toEqual(
      Buffer.from([4, 5, 6, 7]),
    );
    await expect(a.locator(".attachment")).toHaveCount(0);
    await expect(a.locator(".delivery-summary summary")).toHaveCount(2);
    await expect(
      a.locator(".delivery-summary summary").filter({ hasText: "Verified ✓" }),
    ).toHaveCount(2);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});
