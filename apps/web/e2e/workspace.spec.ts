import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import QRCode from "qrcode";
import AxeBuilder from "@axe-core/playwright";
async function create(page: Page, name = "Work Laptop") {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Room", exact: true }).click();
  await page.getByLabel("Device name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create Room", exact: true })
    .last()
    .click();
  await expect(page.getByTestId("room-code")).toHaveText(/\d{6}/);
  return (await page.getByTestId("room-code").innerText()).trim();
}
async function join(page: Page, code: string) {
  await page.goto("/#room=" + code);
  await page.getByLabel("Device name", { exact: true }).fill("My Phone");
  await page
    .getByRole("button", { name: "Join Room", exact: true })
    .last()
    .click();
  await expect(page.locator(".room-heading [role=status]")).toHaveText(
    "Connected",
  );
}

test("four cards, wide workspace, responsive stacking and canonical navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".home-actions button")).toHaveCount(4);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const code = await create(page);
  await expect(
    page.getByRole("navigation", { name: "Sharing options" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Advanced Diagnostics", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByAltText("Scan room invitation")).toHaveCount(0);
  await page.getByRole("button", { name: "Show QR code", exact: true }).click();
  await expect(page.getByAltText("Scan room invitation")).toBeVisible();
  await page.getByRole("button", { name: "Hide QR code", exact: true }).click();
  await expect(page.getByAltText("Scan room invitation")).toHaveCount(0);
  await page.getByLabel("Choose files", { exact: true }).setInputFiles({
    name: "kept.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(24600, 42),
  });
  await expect(
    page.getByRole("list", { name: "Selected attachments" }),
  ).toContainText("24.6 KB");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `../../.flowdrop/workspace-${width}.png`,
        fullPage: true,
      });
    if (width >= 1024) {
      const primary = (await page.locator(".workspace-primary").boundingBox())!,
        aside = (await page.locator(".workspace-aside").boundingBox())!;
      expect(primary.width / (primary.width + aside.width)).toBeGreaterThan(
        0.6,
      );
      expect(primary.width / (primary.width + aside.width)).toBeLessThan(0.7);
      expect(primary.x).toBeLessThan(width * 0.06);
      expect(primary.width + aside.width).toBeGreaterThan(width * 0.85);
    } else {
      const info = (await page.locator(".room-info").boundingBox())!,
        devices = (await page.locator(".devices-panel").boundingBox())!,
        composer = (await page.locator(".file-composer").boundingBox())!;
      expect(devices.y).toBeGreaterThan(info.y);
      expect(composer.y).toBeGreaterThan(devices.y);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await expect(page.locator(".home-actions button")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Return to Room", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Selected attachments" }),
  ).toContainText("kept.txt");
  await page.goBack();
  await expect(page.locator(".home-actions button")).toHaveCount(4);
  await page.goForward();
  await expect(page.getByTestId("room-code")).toHaveText(code);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Room workspace/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Advanced Diagnostics", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "End Room", exact: true }).click();
});

test("attachments add/remove/clear, reconnect persistence and precise send feedback", async ({
  browser,
}) => {
  const ac = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    bc = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
  try {
    await ac.addInitScript(() => {
      const Socket = WebSocket;
      const sockets: WebSocket[] = [];
      Object.assign(window, { workspaceSockets: sockets });
      window.WebSocket = class extends Socket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          sockets.push(this);
        }
      };
    });
    const a = await ac.newPage(),
      b = await bc.newPage();
    const code = await create(a);
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(a.locator(".toast")).toContainText("Choose a file to send.");
    await a.getByLabel("Choose files", { exact: true }).setInputFiles({
      name: "first.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(16003, 11),
    });
    await a.getByLabel("Choose files", { exact: true }).setInputFiles({
      name: "second.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(a.locator(".attachment")).toHaveCount(2);
    await a.getByRole("button", { name: "Remove second.txt" }).click();
    await expect(a.locator(".attachment")).toHaveCount(1);
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(a.locator(".toast")).toContainText(
      "Select at least one device",
    );
    await expect(a.locator(".devices-panel")).toHaveClass(/attention/);
    await join(b, code);
    await a
      .getByRole("checkbox", { name: "Select My Phone", exact: true })
      .check();
    await a.evaluate(() =>
      (window as unknown as { workspaceSockets: WebSocket[] }).workspaceSockets
        .at(-1)
        ?.close(),
    );
    await expect(
      a.getByRole("list", { name: "Selected attachments" }),
    ).toContainText("first.bin");
    await expect(
      a.getByRole("checkbox", { name: "Select My Phone", exact: true }),
    ).toBeChecked();
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(a.locator(".peer-transfer [role=status]")).toContainText(
      "Waiting for receiver approval",
    );
    await expect(a.locator(".peer-transfer [role=status]")).not.toContainText(
      "successfully",
    );
    const download = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await download).path())!)).toEqual(
      Buffer.alloc(16003, 11),
    );
    await expect(a.locator(".peer-transfer [role=status]")).toContainText(
      "File transferred successfully",
    );
    await expect(a.locator(".attachment")).toHaveCount(0);
    await a
      .getByRole("region", { name: "Share Text", exact: true })
      .getByLabel("Message", { exact: true })
      .fill('const value = "Unicode 🌍";\nhttps://example.org/<script>');
    await a.getByRole("button", { name: "Send Text", exact: true }).click();
    await expect(b.locator(".message-history pre")).toContainText("Unicode 🌍");
    await b.bringToFront();
    await b
      .getByRole("button", { name: "Copy received text", exact: true })
      .first()
      .click();
    await expect(b.locator(".toast")).toContainText(/copied|Copy unavailable/i);
    await b.getByRole("button", { name: "Clear history", exact: true }).click();
    await expect(b.locator(".message-history pre")).toHaveCount(0);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("server clock rotates invitation and QR while a file offer and transport remain live", async ({
  browser,
  request,
}) => {
  test.skip(
    !!process.env.FLOWDROP_PUBLIC_URL,
    "Clock advance is available only on the disposable local test host.",
  );
  const ac = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    bc = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    const old = await create(a);
    await join(b, old);
    await a.getByRole("button", { name: "Show QR code", exact: true }).click();
    const qr = await a.getByAltText("Scan room invitation").getAttribute("src");
    await a.getByLabel("Choose files", { exact: true }).setInputFiles({
      name: "rotation.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(1048593, 29),
    });
    await a
      .getByRole("checkbox", { name: "Select My Phone", exact: true })
      .check();
    await a.getByRole("button", { name: "Send to Selected Devices" }).click();
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    expect((await request.post("/__test__/clock")).status()).toBe(200);
    await expect(a.getByTestId("room-code")).not.toHaveText(old);
    await expect(a.getByAltText("Scan room invitation")).not.toHaveAttribute(
      "src",
      qr!,
    );
    await expect(
      b.getByRole("button", { name: "Accept file", exact: true }),
    ).toBeVisible();
    await expect(a.locator(".room-heading [role=status]")).toHaveText(
      "Connected",
    );
    const download = b.waitForEvent("download");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    expect(await readFile((await (await download).path())!)).toEqual(
      Buffer.alloc(1048593, 29),
    );
    expect(
      (
        await request.post("/signal/v2/rooms/" + old + "/join", {
          data: { name: "Old code" },
        })
      ).status(),
    ).toBe(404);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("mobile invitation scanner permission denial and manual fallback", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/join");
  await page.getByLabel("Device name", { exact: true }).fill("Mobile");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Scan QR", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera permission denied",
  );
  await expect(page.getByLabel("Room code", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("synthetic camera QR decodes real invitation and joins only once", async ({
  browser,
}) => {
  const ac = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    bc = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
  try {
    const a = await ac.newPage();
    const code = await create(a);
    const origin = new URL(a.url()).origin;
    const qr = await QRCode.toDataURL(origin + "/#room=" + code, {
      width: 480,
      margin: 4,
    });
    await bc.addInitScript(
      ({ qr }) => {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => {
              const canvas = document.createElement("canvas");
              canvas.width = 640;
              canvas.height = 640;
              const ctx = canvas.getContext("2d")!;
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, 640, 640);
              const img = new Image();
              img.src = qr;
              await img.decode();
              ctx.drawImage(img, 80, 80, 480, 480);
              return canvas.captureStream(10);
            },
          },
        });
      },
      { qr },
    );
    const b = await bc.newPage();
    let joins = 0;
    b.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/join")) joins++;
    });
    await b.goto("/#/join");
    await b.getByLabel("Device name", { exact: true }).fill("Camera fixture");
    await b.getByRole("button", { name: "Continue", exact: true }).click();
    await b.getByRole("button", { name: "Scan QR", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: /Room workspace/ }),
    ).toBeVisible();
    await expect(
      a.getByRole("list", { name: "Connected Devices" }),
    ).toContainText("Camera fixture");
    expect(joins).toBe(1);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("invalid camera invitation stays local and manual join remains available", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage();
    const code = await create(a);
    const qr = await QRCode.toDataURL(
      "https://not-flowdrop.example/#room=123456",
      { width: 480, margin: 4 },
    );
    await bc.addInitScript(
      ({ qr }) => {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => {
              const canvas = document.createElement("canvas");
              canvas.width = 640;
              canvas.height = 640;
              const ctx = canvas.getContext("2d")!;
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, 640, 640);
              const img = new Image();
              img.src = qr;
              await img.decode();
              ctx.drawImage(img, 80, 80, 480, 480);
              return canvas.captureStream(10);
            },
          },
        });
      },
      { qr },
    );
    const b = await bc.newPage();
    let joins = 0;
    b.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/join")) joins++;
      expect(r.url()).not.toContain("not-flowdrop.example");
    });
    await b.goto("/#/join");
    await b.getByLabel("Device name", { exact: true }).fill("Manual fallback");
    await b.getByRole("button", { name: "Continue", exact: true }).click();
    await b.getByRole("button", { name: "Scan QR", exact: true }).click();
    await expect(b.getByRole("alert")).toContainText("from this website");
    expect(joins).toBe(0);
    await b.getByLabel("Room code", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: /Room workspace/ }),
    ).toBeVisible();
    expect(joins).toBe(1);
    await a.getByRole("button", { name: "End Room", exact: true }).click();
  } finally {
    await ac.close();
    await bc.close();
  }
});
