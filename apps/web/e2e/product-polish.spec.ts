import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test("system theme, explicit preference, titles and equal cards survive navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveTitle("FlowDrop - Share Anything");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const theme of ["dark", "light"]) {
    await page.emulateMedia({ colorScheme: theme as "dark" | "light" });
    const header = await page.locator(".site-header").evaluate((el) => ({
      border: getComputedStyle(el).borderBottomWidth,
      shadow: getComputedStyle(el).boxShadow,
    }));
    expect(header).toEqual({ border: "0px", shadow: "none" });
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/flowdrop-mark.svg",
  );
  expect(
    await page
      .locator(".home-card")
      .evaluateAll(
        (nodes) =>
          new Set(nodes.map((n) => getComputedStyle(n).backgroundColor)).size,
      ),
  ).toBe(1);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const title of ["Create Room", "Join Room", "Optical Share"]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(page).toHaveTitle("FlowDrop - " + title);
    await page
      .getByRole("button", { name: "Back to Home", exact: true })
      .click();
  }
  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "../../.flowdrop/product-polish-home.png",
    fullPage: true,
  });
  await context.close();
});
test("host invitation refresh and removal preserve unrelated verified transfer", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const [a, b, c] = await Promise.all(contexts.map((ctx) => ctx.newPage()));
    async function enter(page: typeof a, name: string, code?: string) {
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
    }
    await enter(a, "Host");
    const old = await a.getByTestId("room-code").innerText();
    await enter(b, "Phone", old);
    await enter(c, "Tablet", old);
    for (const name of ["Phone", "Tablet"])
      await expect(
        a.getByRole("listitem").filter({
          has: a.getByRole("checkbox", {
            name: "Select " + name,
            exact: true,
          }),
        }),
      ).toContainText("Connected");
    await a.getByLabel("Message", { exact: true }).fill("Unicode receipt ✓");
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(a.locator(".message-outgoing")).toContainText(
      "Delivered · 2/2",
    );
    await expect(b.locator(".message-incoming pre")).toHaveText(
      "Unicode receipt ✓",
    );
    const longText =
      "<script>alert('safe text')</script> ✓\nhttps://example.com/" +
      "x".repeat(350);
    await a.getByLabel("Message", { exact: true }).fill(longText);
    await a.getByLabel("Message", { exact: true }).press("Shift+Enter");
    await expect(a.getByLabel("Message", { exact: true })).toHaveValue(
      longText + "\n",
    );
    await a.getByLabel("Message", { exact: true }).press("Enter");
    await expect(b.locator(".message-incoming pre").first()).toHaveText(
      longText.trim(),
    );
    await a.setViewportSize({ width: 390, height: 844 });
    expect(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await a.screenshot({
      path: "../../.flowdrop/ui-polish-mobile-chat.png",
      fullPage: true,
    });
    await a.setViewportSize({ width: 1280, height: 900 });
    const bytes = Buffer.from([0, 255, 13, 10, 44, 88]);
    await a.getByLabel("Choose files", { exact: true }).setInputFiles({
      name: "survive.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      c.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    a.on("dialog", (dialog) => dialog.accept());
    await a.getByRole("button", { name: "Lock Room", exact: true }).click();
    await a
      .getByRole("button", { name: "Refresh Invitation", exact: true })
      .click();
    const modal = a.getByRole("dialog", { name: "Refresh invitation?" });
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(a.getByTestId("room-code")).toHaveText(old);
    let refreshRequests = 0;
    await a.route("**/v2/rooms/*/invitation", async (route) => {
      refreshRequests++;
      if (refreshRequests === 1)
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"detail":"Temporary test failure"}',
        });
      else {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.continue();
      }
    });
    await a
      .getByRole("button", { name: "Refresh Invitation", exact: true })
      .click();
    await a.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await a
      .getByRole("button", { name: "Refresh Invitation", exact: true })
      .click();
    const viewport = a.viewportSize()!;
    await expect
      .poll(async () => {
        const box = await modal.boundingBox();
        return Math.max(
          Math.abs(box!.x + box!.width / 2 - viewport.width / 2),
          Math.abs(box!.y + box!.height / 2 - viewport.height / 2),
        );
      })
      .toBeLessThan(3);
    await modal
      .getByRole("button", { name: "Refresh Code", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText("Please try again");
    await expect(a.getByTestId("room-code")).toHaveText(old);
    await a.screenshot({ path: "../../.flowdrop/ui-polish-invitation.png" });
    await modal
      .getByRole("button", { name: "Refresh Code", exact: true })
      .click();
    await expect(
      modal.getByRole("button", { name: "Refreshing…", exact: true }),
    ).toBeDisabled();
    await expect(modal).not.toBeVisible();
    expect(refreshRequests).toBe(2);
    await expect(a.getByTestId("room-code")).not.toHaveText(old);
    await expect(
      a.getByRole("button", { name: "Unlock Room", exact: true }),
    ).toBeVisible();
    await expect(b.getByTestId("room-code")).toHaveText(
      await a.getByTestId("room-code").innerText(),
    );
    await a.getByLabel("Actions for Phone", { exact: true }).click();
    await a
      .getByRole("button", { name: "Remove from Room", exact: true })
      .click();
    await expect(b.getByRole("alert")).toContainText(
      "The room host removed your device.",
    );
    await expect(
      a.getByRole("checkbox", { name: "Select Phone", exact: true }),
    ).toHaveCount(0);
    const download = c.waitForEvent("download");
    await c.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await download).path())!)).toEqual(bytes);
    await expect(
      a.getByText("New invitation ready.", { exact: true }),
    ).toHaveCount(0, { timeout: 10000 });
    await a.screenshot({
      path: "../../.flowdrop/product-polish-room.png",
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});

test("signaling recovery before the first DataChannel resets both unfinished peers", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    for (const ctx of contexts)
      await ctx.addInitScript(() => {
        const sockets: WebSocket[] = [];
        const pcs: RTCPeerConnection[] = [];
        const events: string[] = [];
        const PC = RTCPeerConnection;
        window.RTCPeerConnection = class extends PC {
          constructor(config?: RTCConfiguration) {
            super(config);
            pcs.push(this);
          }
        };
        const state = { allow: false, sockets, pcs, events };
        Object.assign(window, { earlyRecovery: state });
        const Original = WebSocket;
        window.WebSocket = class extends Original {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            sockets.push(this);
            this.addEventListener("message", (e) => {
              try {
                const event = JSON.parse(e.data);
                events.push("in:" + event.type);
              } catch {
                /* ignored token authentication */
              }
            });
          }
          send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
            if (
              typeof data === "string" &&
              data.startsWith("{") &&
              JSON.parse(data).type === "offer" &&
              !state.allow
            )
              return;
            if (typeof data === "string" && data.startsWith("{"))
              events.push("out:" + JSON.parse(data).type);
            super.send(data);
          }
        };
      });
    const [a, b] = await Promise.all(contexts.map((ctx) => ctx.newPage()));
    await a.goto("/");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await a.getByLabel("Device name", { exact: true }).fill("First");
    await a
      .getByRole("button", { name: "Create Room", exact: true })
      .last()
      .click();
    await expect(a.getByTestId("room-code")).toHaveText(/\d{6}/);
    const code = await a.getByTestId("room-code").innerText();
    await b.goto("/#room=" + code);
    await b.getByLabel("Device name", { exact: true }).fill("Second");
    await b
      .getByRole("button", { name: "Join Room", exact: true })
      .last()
      .click();
    await expect(
      a.getByRole("checkbox", { name: "Select Second", exact: true }),
    ).toBeVisible();
    const ids = await Promise.all(
      [a, b].map((p) =>
        p.evaluate(
          () =>
            JSON.parse(sessionStorage.getItem("flowdrop-room-v2")!)
              .member as string,
        ),
      ),
    );
    const recovering = ids[0] > ids[1] ? a : b;
    for (const page of [a, b])
      await page.evaluate(() => {
        (
          window as unknown as { earlyRecovery: { allow: boolean } }
        ).earlyRecovery.allow = true;
      });
    await recovering.evaluate(() =>
      (
        window as unknown as { earlyRecovery: { sockets: WebSocket[] } }
      ).earlyRecovery.sockets
        .at(-1)!
        .close(),
    );
    try {
      for (const page of [a, b])
        await expect(page.locator(".room-heading [role=status]")).toHaveText(
          "Connected",
        );
    } catch (error) {
      for (const page of [a, b])
        console.log(
          await page.evaluate(() => {
            const s = (
              window as unknown as {
                earlyRecovery: { pcs: RTCPeerConnection[]; events: string[] };
              }
            ).earlyRecovery;
            return {
              events: s.events,
              pcs: s.pcs.map((p) => ({
                connection: p.connectionState,
                signaling: p.signalingState,
                ice: p.iceConnectionState,
              })),
            };
          }),
        );
      throw error;
    }
    await a
      .getByLabel("Message", { exact: true })
      .fill("Recovered channel real text");
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(b.locator(".message-incoming pre")).toHaveText(
      "Recovered channel real text",
    );
    await expect(a.locator(".message-outgoing")).toContainText(
      "Delivered · 1/1",
    );
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});

test("a removed offline device stops recovery after membership rejection", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    await bc.addInitScript(() => {
      const sockets: WebSocket[] = [];
      Object.assign(window, { offlineRemovalSockets: sockets });
      const Original = WebSocket;
      window.WebSocket = class extends Original {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          sockets.push(this);
        }
      };
    });
    const a = await ac.newPage(),
      b = await bc.newPage();
    await a.goto("/");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await a.getByLabel("Device name", { exact: true }).fill("Host");
    await a
      .getByRole("button", { name: "Create Room", exact: true })
      .last()
      .click();
    await expect(a.getByTestId("room-code")).toHaveText(/\d{6}/);
    await b.goto("/#room=" + (await a.getByTestId("room-code").innerText()));
    await b.getByLabel("Device name", { exact: true }).fill("Offline phone");
    await b
      .getByRole("button", { name: "Join Room", exact: true })
      .last()
      .click();
    await expect(
      a.getByRole("listitem").filter({
        has: a.getByRole("checkbox", {
          name: "Select Offline phone",
          exact: true,
        }),
      }),
    ).toContainText("Connected");
    await b.evaluate(() =>
      (
        window as unknown as { offlineRemovalSockets: WebSocket[] }
      ).offlineRemovalSockets
        .at(-1)!
        .close(),
    );
    a.on("dialog", (dialog) => dialog.accept());
    await a.getByLabel("Actions for Offline phone", { exact: true }).click();
    await a
      .getByRole("button", { name: "Remove from Room", exact: true })
      .click();
    await expect(b.getByRole("alert")).toContainText(
      /removed your device|room access has ended/,
    );
    await expect(
      b.getByRole("button", { name: "Retry Connection", exact: true }),
    ).toHaveCount(0);
    expect(
      await b.evaluate(() => sessionStorage.getItem("flowdrop-room-v2")),
    ).toBeNull();
  } finally {
    await Promise.all([ac.close(), bc.close()]);
  }
});
