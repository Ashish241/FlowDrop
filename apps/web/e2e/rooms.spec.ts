import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function create(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Room", exact: true }).click();
  await page.getByLabel("Device name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create Room", exact: true })
    .last()
    .click();
  await expect(page.getByTestId("room-code")).toHaveText(/\d{6}/);
  await page.getByRole("button", { name: "Show QR code", exact: true }).click();
  await expect(page.getByAltText("Scan room invitation")).toBeVisible();
  await page.getByRole("button", { name: "Hide QR code", exact: true }).click();
  return (await page.getByTestId("room-code").innerText()).trim();
}
async function join(page: Page, code: string, name: string) {
  await page.goto("/#room=" + code);
  await page.getByLabel("Device name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Join Room", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("list", { name: "Connected Devices" }),
  ).toContainText(name);
}
async function selectFile(page: Page, name: string, buffer: Buffer) {
  if (
    await page.getByRole("button", { name: "Clear Files", exact: true }).count()
  )
    await page
      .getByRole("button", { name: "Clear Files", exact: true })
      .click();
  await page
    .getByLabel("Choose files", { exact: true })
    .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
}
async function accept(page: Page, bytes: Buffer) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Accept file", exact: true }).click();
  expect(await readFile((await (await download).path())!)).toEqual(bytes);
}
test("named room auto-join, three real peers, rename and recipient-isolated transfers", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    for (const context of contexts)
      await context.addInitScript(() => {
        const Peer = RTCPeerConnection;
        const channels: RTCDataChannel[] = [];
        Object.assign(window, { roomTestChannels: channels });
        window.RTCPeerConnection = class extends Peer {
          constructor(config?: RTCConfiguration) {
            super(config);
            this.addEventListener("datachannel", (e) =>
              channels.push(e.channel),
            );
          }
          createDataChannel(label: string, options?: RTCDataChannelInit) {
            const channel = super.createDataChannel(label, options);
            channels.push(channel);
            return channel;
          }
        };
        const Socket = WebSocket;
        const sockets: WebSocket[] = [];
        Object.assign(window, { roomTestSockets: sockets });
        window.WebSocket = class extends Socket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            sockets.push(this);
          }
        };
      });
    const [a, b, c, d] = await Promise.all(
      contexts.map((ctx) => ctx.newPage()),
    );
    const code = await create(a, "Laptop");
    await join(b, code, "Phone");
    await join(c, code, "Tablet");
    for (const p of [a, b, c]) {
      await expect(
        p.getByRole("list", { name: "Connected Devices" }),
      ).toContainText("Laptop");
      await expect(
        p.getByRole("list", { name: "Connected Devices" }),
      ).toContainText("Phone");
      await expect(
        p.getByRole("list", { name: "Connected Devices" }),
      ).toContainText("Tablet");
      await expect(
        p.getByRole("button", { name: "Approve receiver" }),
      ).toHaveCount(0);
      await expect(
        p.getByRole("region", { name: "Send Files", exact: true }),
      ).toBeVisible();
    }
    await a.getByRole("button", { name: "Edit device name" }).click();
    await a.getByLabel("New device name").fill("Office Laptop");
    await a.getByRole("button", { name: "Save name" }).click();
    await expect(
      b.getByRole("list", { name: "Connected Devices" }),
    ).toContainText("Office Laptop");
    await expect(
      a.getByRole("checkbox", { name: "Select Office Laptop" }),
    ).toHaveCount(0);
    await expect(
      a.getByRole("checkbox", { name: "Select Tablet", exact: true }),
    ).toBeVisible();
    for (const name of ["Phone", "Tablet"])
      await expect(
        a.getByRole("listitem").filter({
          has: a.getByRole("checkbox", { name: `Select ${name}`, exact: true }),
        }),
      ).toContainText("Connected");
    await a.getByRole("button", { name: "Select All", exact: true }).click();
    await expect(
      a
        .getByRole("region", { name: "Device selection", exact: true })
        .getByText("2 selected", { exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Clear Selection" }).click();
    const bytes = Buffer.alloc(1048583, 57);
    await selectFile(a, "forward.bin", bytes);
    await a
      .getByRole("checkbox", { name: "Select Phone", exact: true })
      .check();
    await expect(
      a.getByRole("button", { name: "Send to Selected Devices" }),
    ).toBeEnabled({ timeout: 30000 });
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toHaveCount(0);
    // Out-of-order completion cannot mark a pending offer successful.
    await b.evaluate(() => {
      for (const dc of (
        window as unknown as { roomTestChannels: RTCDataChannel[] }
      ).roomTestChannels)
        if (dc.readyState === "open") {
          dc.send(JSON.stringify({ type: "verified" }));
          dc.send(
            JSON.stringify({ type: "text", text: "control-order-check" }),
          );
        }
    });
    await expect(
      a
        .locator(".message-history pre")
        .filter({ hasText: "control-order-check" }),
    ).toHaveCount(1);
    await expect(
      a
        .locator(".recipient-transfer .flow-state")
        .filter({ hasText: "File transferred successfully" }),
    ).toHaveCount(0);
    // A late member is never added to the active recipient snapshot.
    await join(d, code, "Late device");
    await expect(
      d.getByRole("button", { name: "Accept file", exact: true }),
    ).toHaveCount(0);
    await a.getByRole("button", { name: "Edit device name" }).click();
    await a.getByLabel("New device name").fill("Renamed while waiting");
    await a.getByRole("button", { name: "Save name" }).click();
    await expect(
      b.getByText("From Renamed while waiting", { exact: false }),
    ).toBeVisible();
    await accept(b, bytes);
    const reverse = Buffer.from([0, 255, 13, 10, 42]);
    await selectFile(b, "reverse.bin", reverse);
    await b
      .getByRole("button", { name: "Clear Selection", exact: true })
      .click();
    await b
      .getByRole("checkbox", {
        name: "Select Renamed while waiting",
        exact: true,
      })
      .check();
    await expect(
      b.getByRole("button", { name: "Send to Selected Devices" }),
    ).toBeEnabled();
    await b.getByRole("button", { name: "Send to Selected Devices" }).click();
    await accept(a, reverse);
    await a
      .getByRole("checkbox", { name: "Select Tablet", exact: true })
      .check();
    await a
      .getByRole("checkbox", { name: "Select Late device", exact: true })
      .uncheck();
    await selectFile(a, "multi.bin", Buffer.alloc(262151, 22));
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await b.getByRole("button", { name: "Decline", exact: true }).click();
    await accept(c, Buffer.alloc(262151, 22));
    await expect(
      a
        .locator(".peer-transfer .flow-state")
        .filter({ hasText: "Transfer declined by receiver." }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Lock Room", exact: true }).click();
    await d.getByRole("button", { name: "Leave Room" }).click();
    await expect(d.locator(".home-actions button")).toHaveCount(4);
    await d.goto("/#room=" + code);
    await d.getByLabel("Device name", { exact: true }).fill("Locked out");
    await d
      .getByRole("button", { name: "Join Room", exact: true })
      .last()
      .click();
    await expect(d.getByRole("alert")).toContainText("locked");
    await b.evaluate(() => {
      const w = window as unknown as { roomTestSockets: WebSocket[] };
      w.roomTestSockets.at(-1)?.close();
    });
    await expect(
      b.getByRole("list", { name: "Connected Devices" }),
    ).toContainText("Renamed while waiting");
    await expect(b.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await b.reload();
    await expect(
      b.getByRole("list", { name: "Connected Devices" }),
    ).toContainText("Renamed while waiting");
    await expect(b.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    // Explicit batch acceptance authorizes only the displayed manifest.
    await a.getByRole("button", { name: "Unlock Room", exact: true }).click();
    await b.getByRole("button", { name: "Select All", exact: true }).click();
    await b
      .getByRole("button", { name: "Clear Selection", exact: true })
      .click();
    await b
      .getByRole("checkbox", {
        name: "Select Renamed while waiting",
        exact: true,
      })
      .check();
    if (
      await b.getByRole("button", { name: "Clear Files", exact: true }).count()
    )
      await b.getByRole("button", { name: "Clear Files", exact: true }).click();
    await b.getByLabel("Choose files", { exact: true }).setInputFiles([
      {
        name: "batch-one.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([11, 12]),
      },
      {
        name: "batch-two.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([21, 22, 23]),
      },
    ]);
    await expect(
      b.getByRole("button", { name: "Send to Selected Devices" }),
    ).toBeEnabled();
    await b.getByRole("button", { name: "Send to Selected Devices" }).click();
    const downloads: Buffer[] = [];
    const done = new Promise<void>((resolve, reject) =>
      a.on("download", async (download) => {
        try {
          downloads.push(await readFile((await download.path())!));
          if (downloads.length === 2) resolve();
        } catch (e) {
          reject(e);
        }
      }),
    );
    await a
      .getByRole("button", { name: "Accept batch (2 files)", exact: true })
      .click();
    await done;
    expect(downloads).toEqual([
      Buffer.from([11, 12]),
      Buffer.from([21, 22, 23]),
    ]);
    await b.setViewportSize({ width: 390, height: 844 });
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Withhold close notifications: the explicit terminal event must suffice.
    await b.evaluate(() => {
      const w = window as unknown as {
        roomTestSockets: WebSocket[];
        roomEndEvents: number;
      };
      w.roomEndEvents = 0;
      const socket = w.roomTestSockets.at(-1)!;
      socket.addEventListener(
        "close",
        (event) => event.stopImmediatePropagation(),
        {
          capture: true,
        },
      );
      socket.addEventListener("message", (event) => {
        if (JSON.parse(event.data).type === "ended") w.roomEndEvents++;
      });
    });
    await a.getByRole("button", { name: "End Room", exact: true }).click();
    await expect(b.getByRole("alert")).toContainText(/expired|ended/);
    expect(
      await b.evaluate(
        () => (window as unknown as { roomEndEvents: number }).roomEndEvents,
      ),
    ).toBe(1);
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});
test("name consent and invalid room feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Join Room", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Device name", { exact: true }).fill("  Mobile  ");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Room code", { exact: true }).fill("999999");
  await page
    .getByRole("button", { name: "Join Room", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText(/expired|unavailable/);
  expect(
    await page.evaluate(() => localStorage.getItem("flowdrop-device-name")),
  ).toBeNull();
});

test("pause, rename during byte transfer, resume, cancellation and text stay independent", async ({
  browser,
  request,
}, info) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    const code = await create(a, "Sender");
    await join(b, code, "Receiver");
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await a
      .getByRole("checkbox", { name: "Select Receiver", exact: true })
      .check();
    const bytes = Buffer.alloc(32 * 1024 * 1024 + 3, 81);
    const largePath = info.outputPath("paused.bin");
    await writeFile(largePath, bytes);
    await a
      .getByLabel("Choose files", { exact: true })
      .setInputFiles(largePath);
    await expect(
      a.getByRole("button", { name: "Send to Selected Devices" }),
    ).toBeEnabled();
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("progressbar", { name: "Transfer progress" }),
    ).toHaveAttribute("value", "0");
    const download = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    await b
      .getByRole("button", { name: "Pause transfer", exact: true })
      .click();
    await b.getByRole("button", { name: "Edit device name" }).click();
    await b.getByLabel("New device name").fill("Receiver renamed");
    await b.getByRole("button", { name: "Save name" }).click();
    await expect(
      a.getByRole("list", { name: "Connected Devices" }),
    ).toContainText("Receiver renamed");
    if (info.project.use.baseURL === "http://127.0.0.1:8770") {
      const oldCode = (await a.getByTestId("room-code").innerText()).trim();
      expect((await request.post("/__test__/clock")).status()).toBe(200);
      await expect(a.getByTestId("room-code")).not.toHaveText(oldCode);
      await expect(
        b.getByRole("button", { name: "Resume transfer", exact: true }),
      ).toBeVisible();
    }
    await b
      .getByRole("button", { name: "Resume transfer", exact: true })
      .click();
    expect(
      createHash("sha256")
        .update(await readFile((await (await download).path())!))
        .digest("hex"),
    ).toBe(createHash("sha256").update(bytes).digest("hex"));
    await selectFile(a, "cancelled.bin", Buffer.from([99]));
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Cancel transfer", exact: true })
      .click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toHaveCount(0);
    for (const [sender, receiver, target] of [
      [a, b, "Receiver renamed"],
      [b, a, "Sender"],
    ] as const) {
      await sender
        .getByRole("button", { name: "Select All", exact: true })
        .click();
      expect(target).toBeTruthy();
      await sender
        .getByRole("region", { name: "Share Text", exact: true })
        .getByLabel("Message", { exact: true })
        .focus();
      await sender
        .getByRole("region", { name: "Share Text", exact: true })
        .getByLabel("Message", { exact: true })
        .fill("<script>literal</script>");
      await sender
        .getByRole("button", { name: "Send Text", exact: true })
        .click();
      const detail = receiver.getByRole("region", {
        name: "Share Text",
        exact: true,
      });
      await expect(detail.locator("pre").first()).toHaveText(
        "<script>literal</script>",
      );
    }
    await a.screenshot({
      path: "../../.flowdrop/room-dashboard-verified.png",
      fullPage: true,
    });
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});
