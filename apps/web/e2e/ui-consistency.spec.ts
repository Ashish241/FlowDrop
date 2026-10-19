import { test, expect } from "@playwright/test";

test("body navigation, guarded room creation and retryable end confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Room", exact: true }).click();
  await expect(
    page.locator("header").getByRole("button", { name: "Back to Home" }),
  ).toHaveCount(0);
  await expect(
    page.locator("main").getByRole("button", { name: "Back to Home" }),
  ).toBeVisible();
  await page
    .getByLabel("Device name", { exact: true })
    .fill("Consistency Host");
  let releaseCreate!: () => void;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  let creates = 0;
  await page.route("**/v2/rooms", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    creates++;
    await createGate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Create Room", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Creating room…" }),
  ).toBeDisabled();
  expect(creates).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByRole("button", { name: "Creating room…" })
      .locator(".loader-drop")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.screenshot({
      path: `../../.flowdrop/ui-consistency-loading-${theme}.png`,
      fullPage: true,
    });
  }
  releaseCreate();
  await expect(page.getByTestId("room-code")).toHaveText(/\d{6}/);
  let releaseEnd!: () => void;
  const endGate = new Promise<void>((resolve) => {
    releaseEnd = resolve;
  });
  let ends = 0;
  await page.route("**/v2/rooms/*/membership", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.continue();
      return;
    }
    ends++;
    if (ends === 1) {
      await endGate;
      await route.fulfill({
        status: 503,
        headers: {
          "access-control-allow-origin": "https://flowdrop-online.pages.dev",
        },
        contentType: "application/json",
        body: JSON.stringify({ detail: "Temporary test outage" }),
      });
    } else await route.continue();
  });
  const trigger = page.getByRole("button", { name: "End Room", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "End room?" });
  await expect(modal).toBeVisible();
  await page.screenshot({
    path: "../../.flowdrop/ui-consistency-confirmation.png",
    fullPage: true,
  });
  await expect(modal.getByRole("button", { name: "Cancel" })).toBeFocused();
  await modal.getByRole("button", { name: "Cancel" }).click();
  expect(ends).toBe(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await modal.getByRole("button", { name: "End Room", exact: true }).click();
  await expect(
    modal.getByRole("button", { name: "Ending room…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  expect(ends).toBe(1);
  releaseEnd();
  await expect(modal.getByRole("alert")).toContainText("Temporary test outage");
  await expect(
    modal.getByRole("button", { name: "End Room", exact: true }),
  ).toBeEnabled();
  await modal.getByRole("button", { name: "End Room", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sharing, in your space." }),
  ).toBeVisible();
  expect(ends).toBe(2);
});

test("optical body back and reduced motion preserve sender input", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/optical");
  await page.getByRole("button", { name: "Send via Screen" }).click();
  await page
    .getByLabel("Optical text", { exact: true })
    .fill("Keep this selection");
  await page
    .getByRole("button", { name: "Back to Optical Share", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Optical sender" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Send via Screen" }).click();
  await expect(page.getByLabel("Optical text", { exact: true })).toHaveValue(
    "Keep this selection",
  );
});

test("real peer chat appends, deduplicates replay and respects reading scroll", async ({
  browser,
}) => {
  const host = await browser.newContext(),
    guest = await browser.newContext();
  try {
    await host.addInitScript(() => {
      const Peer = RTCPeerConnection;
      const channels: RTCDataChannel[] = [];
      Object.assign(window, { chatChannels: channels });
      window.RTCPeerConnection = class extends Peer {
        constructor(config?: RTCConfiguration) {
          super(config);
          this.addEventListener("datachannel", (event) =>
            channels.push(event.channel),
          );
        }
        createDataChannel(label: string, options?: RTCDataChannelInit) {
          const channel = super.createDataChannel(label, options);
          channels.push(channel);
          return channel;
        }
      };
    });
    const a = await host.newPage(),
      b = await guest.newPage();
    await a.goto("/#/create");
    await a.getByLabel("Device name", { exact: true }).fill("Chat Host");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(a.getByTestId("room-code")).toHaveText(/\d{6}/);
    const code = await a.getByTestId("room-code").innerText();
    await b.goto("/#room=" + code.trim());
    await b.getByLabel("Device name", { exact: true }).fill("Chat Phone");
    await b.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(
      a.getByRole("checkbox", { name: "Select Chat Phone", exact: true }),
    ).toBeChecked();
    await expect(a.locator(".peer-transfer")).toHaveAttribute(
      "data-channel-state",
      "open",
    );
    await a.getByLabel("Message", { exact: true }).fill("first");
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(b.locator(".message-history pre")).toHaveText(["first"]);
    await expect(a.locator(".message-outgoing")).toContainText("Delivered");
    await a.evaluate(() => {
      const channel = (
        window as unknown as { chatChannels: RTCDataChannel[] }
      ).chatChannels.find((item) => item.readyState === "open")!;
      const id = crypto.randomUUID();
      channel.send(JSON.stringify({ type: "text", id, text: "second" }));
      channel.send(JSON.stringify({ type: "text", id, text: "second" }));
      for (let index = 0; index < 18; index++)
        channel.send(
          JSON.stringify({
            type: "text",
            id: crypto.randomUUID(),
            text: `message ${index}\nline two\nline three`,
          }),
        );
    });
    await expect(b.locator(".message-history pre")).toHaveCount(20);
    await expect(b.locator(".message-history pre").nth(1)).toHaveText("second");
    const list = b.getByRole("list", { name: "Text history" });
    await list.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await a.getByLabel("Message", { exact: true }).fill("last");
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(b.locator(".message-history pre").last()).toHaveText("last");
    expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await a.getByLabel("Message", { exact: true }).fill("newest");
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(b.locator(".message-history pre").last()).toHaveText("newest");
    await expect
      .poll(() =>
        list.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThan(5);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
    await a
      .getByRole("dialog", { name: "End room?" })
      .getByRole("button", { name: "End Room", exact: true })
      .click();
    await expect(
      b.getByRole("heading", { name: "This room has ended" }),
    ).toBeVisible();
    let obsoleteLeaves = 0;
    await b.route("**/v2/rooms/*/membership", async (route) => {
      obsoleteLeaves++;
      await route.abort();
    });
    await b.getByRole("button", { name: "Return to Home", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "Sharing, in your space." }),
    ).toBeVisible();
    expect(obsoleteLeaves).toBe(0);
  } finally {
    await host.close();
    await guest.close();
  }
});

test("camera permission timeout stops loading and permits retry without physical camera", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => {}) },
    });
  });
  await page.goto("/#/optical");
  await page.getByRole("button", { name: "Receive via Camera" }).click();
  await expect(
    page.getByText("Decoder ready · processing runs in a Web Worker", {
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Starting camera…" }),
  ).toBeDisabled();
  await page.clock.fastForward(30001);
  await expect(page.locator(".optical-panel > p[role=status]")).toContainText(
    "timed out",
  );
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Starting camera…" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeEnabled();
});
