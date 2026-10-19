import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function open(page: Page, receive = false) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Optical Share", exact: true })
    .click();
  await expect(
    page.getByText("Decoder ready · processing runs in a Web Worker", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: receive ? "Receive via Camera" : "Send via Screen",
    })
    .click();
  if (!receive)
    await page.getByText("Advanced display settings", { exact: true }).click();
}
async function png(page: Page, alt: RegExp) {
  const src = await page.getByAltText(alt).getAttribute("src");
  return Buffer.from(src!.split(",")[1], "base64");
}
async function upload(
  page: Page,
  buffer: Buffer,
  label = "Import QR frame image (camera-free fallback)",
) {
  const before = Number(
    await page.locator(".optical-panel").getAttribute("data-optical-decoded"),
  );
  await page
    .getByLabel(label, { exact: true })
    .setInputFiles({ name: "frame.png", mimeType: "image/png", buffer });
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".optical-panel")
          .getAttribute("data-optical-decoded"),
      ),
    )
    .toBeGreaterThan(before);
}
test("64 KiB actual sender QRs reconstruct offline after loss, interrupted scans, duplicate frames and reverse recovery QR", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    await open(a);
    await open(b, true);
    await a.getByLabel("Optical content type").selectOption("file");
    await a.getByLabel("Parity per 8 data frames").selectOption("0");
    let seed = 742519;
    const bytes = Buffer.from(
      Array.from({ length: 65536 }, () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed & 255;
      }),
    );
    await a.getByLabel("Small optical file (64 KiB maximum)").setInputFiles({
      name: "camera-64k.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await a
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    await expect(
      a.getByAltText("Optical frame 1 of 164", { exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Pause frames", exact: true }).click();
    const calls: string[] = [];
    for (const context of [ac, bc])
      context.on("request", (request) => {
        if (/^https?:/.test(request.url())) calls.push(request.url());
      });
    await ac.setOffline(true);
    await bc.setOffline(true);
    let kept = 0,
      first: Buffer | undefined;
    for (let i = 0; i < 164; i++) {
      await expect(
        a.getByAltText(`Optical frame ${i + 1} of 164`, { exact: true }),
      ).toBeVisible();
      const frame = await png(a, /^Optical frame /);
      if (i % 7 !== 0 && !(i >= 40 && i < 44) && i !== 163) {
        await upload(b, frame);
        kept++;
        await expect(b.locator(".optical-panel")).toHaveAttribute(
          "data-optical-received",
          String(kept),
        );
        if (!first) first = frame;
      }
      if (i === 80) {
        await b
          .getByRole("button", { name: "Stop camera", exact: true })
          .click();
        await upload(b, first!);
        await expect(b.getByRole("status")).toContainText("Duplicates 1");
      }
      if (i < 163)
        await a
          .getByRole("button", { name: "Next frame", exact: true })
          .click();
    }
    await expect(
      b.getByRole("button", {
        name: "Download reconstructed file",
        exact: true,
      }),
    ).toHaveCount(0);
    await b
      .getByRole("button", { name: "Recover Missing Frames", exact: true })
      .click();
    const request = await png(b, /^Recovery request /);
    await a
      .getByText("Recovery Mode · send only missing frames", { exact: true })
      .click();
    await upload(a, request, "Import recovery QR image");
    const missing = 164 - kept;
    await expect(a.getByRole("status")).toContainText(
      `Sending only ${missing} requested data frames`,
    );
    await expect(
      a.getByAltText(`Optical frame 1 of ${missing}`, { exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Pause frames", exact: true }).click();
    for (let i = 0; i < missing; i++) {
      await expect(
        a.getByAltText(`Optical frame ${i + 1} of ${missing}`, { exact: true }),
      ).toBeVisible();
      await upload(b, await png(a, /^Optical frame /));
      if (i < missing - 1)
        await a
          .getByRole("button", { name: "Next frame", exact: true })
          .click();
    }
    await expect(b.getByRole("status")).toContainText(
      "Completed · SHA-256 verified",
    );
    const download = b.waitForEvent("download");
    await b
      .getByRole("button", { name: "Download reconstructed file", exact: true })
      .click();
    const actual = await readFile((await (await download).path())!);
    expect(actual).toEqual(bytes);
    expect(createHash("sha256").update(actual).digest("hex")).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(calls).toEqual([]);
    await b.setViewportSize({ width: 390, height: 844 });
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await b.screenshot({
      path: "../../.flowdrop/optical-64k-verified.png",
      fullPage: true,
    });
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("synthetic camera video reaches real worker decoder and completes single-frame v3 Unicode text", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage();
    await open(a);
    const message = "Synthetic camera · こんにちは 🌍";
    await a.getByLabel("Optical text", { exact: true }).fill(message);
    await a
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    await expect(
      a.getByAltText("Optical frame 1 of 1", { exact: true }),
    ).toBeVisible();
    const src = await a
      .getByAltText("Optical frame 1 of 1", { exact: true })
      .getAttribute("src");
    await bc.addInitScript(
      ({ src }) => {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => {
              const canvas = document.createElement("canvas");
              canvas.width = 720;
              canvas.height = 1280;
              const image = new Image();
              image.src = src!;
              await image.decode();
              const ctx = canvas.getContext("2d")!;
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, 720, 1280);
              ctx.drawImage(image, 60, 340, 600, 600);
              const stream = canvas.captureStream(10);
              Object.assign(window, { syntheticOpticalCanvas: canvas });
              return stream;
            },
          },
        });
      },
      { src },
    );
    const b = await bc.newPage();
    await open(b, true);
    await b.getByLabel("Camera resolution").selectOption("720");
    await b.getByRole("button", { name: "Start camera", exact: true }).click();
    await expect(b.getByRole("status")).toContainText(
      "Completed · SHA-256 verified",
    );
    await expect(b.getByLabel("Received text — select to copy")).toHaveValue(
      message,
    );
    expect(
      Number(
        await b.locator(".optical-panel").getAttribute("data-optical-decoded"),
      ),
    ).toBeGreaterThan(0);
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("manual missing-frame recovery works without cameras and preserves multiframe text", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    await open(a);
    await open(b, true);
    const message = "Unicode 多言語 🌍\n".repeat(50);
    await a.getByLabel("Optical text", { exact: true }).fill(message);
    await a.getByLabel("Parity per 8 data frames").selectOption("0");
    await a.getByLabel("Compress only when smaller").uncheck();
    await a
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    await expect(a.getByAltText(/^Optical frame 1 of /)).toBeVisible();
    await a.getByRole("button", { name: "Pause frames", exact: true }).click();
    const total = Number(
      (await a.getByAltText(/^Optical frame /).getAttribute("alt"))!.split(
        " of ",
      )[1],
    );
    expect(total).toBeGreaterThan(1);
    for (let i = 0; i < total; i++) {
      await expect(
        a.getByAltText(`Optical frame ${i + 1} of ${total}`, { exact: true }),
      ).toBeVisible();
      if (i !== 1) await upload(b, await png(a, /^Optical frame /));
      if (i < total - 1)
        await a
          .getByRole("button", { name: "Next frame", exact: true })
          .click();
    }
    await expect(
      b.getByLabel("Missing frame numbers", { exact: true }),
    ).toHaveValue("2");
    await a
      .getByText("Recovery Mode · send only missing frames", { exact: true })
      .click();
    await a
      .getByLabel("Missing frame numbers to resend", { exact: true })
      .fill("2");
    await a
      .getByRole("button", { name: "Send requested frames", exact: true })
      .click();
    await expect(
      a.getByAltText("Optical frame 1 of 1", { exact: true }),
    ).toBeVisible();
    await upload(b, await png(a, /^Optical frame /));
    await expect(b.getByRole("status")).toContainText(
      "Completed · SHA-256 verified",
    );
    await expect(b.getByLabel("Received text — select to copy")).toHaveValue(
      message,
    );
    await b.getByRole("button", { name: "Verify File", exact: true }).click();
    await expect(b.getByRole("status")).toContainText("verified again");
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("rendered animation holds each QR for the configured dwell, measured from actual image-load events", async ({
  page,
}) => {
  await open(page);
  await page
    .getByLabel("Optical text", { exact: true })
    .fill("Timing · 世界".repeat(100));
  await page.getByLabel("Compress only when smaller").uncheck();
  await page.getByLabel("Parity per 8 data frames").selectOption("0");
  await page.evaluate(() => {
    const times: number[] = [];
    Object.assign(window, { opticalRenderTimes: times });
    document.addEventListener(
      "load",
      (event) => {
        if (
          event.target instanceof HTMLImageElement &&
          event.target.closest(".optical-screen")
        )
          times.push(performance.now());
      },
      true,
    );
  });
  await page
    .getByRole("button", { name: "Start Transfer", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { opticalRenderTimes: number[] })
            .opticalRenderTimes.length,
      ),
    )
    .toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Pause frames", exact: true }).click();
  const times = await page.evaluate(
    () =>
      (window as unknown as { opticalRenderTimes: number[] })
        .opticalRenderTimes,
  );
  const intervals = times.slice(1).map((time, index) => time - times[index]);
  expect(intervals.every((value) => value >= 950)).toBe(true);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    "../../.flowdrop/optical-render-timing.json",
    JSON.stringify(
      {
        scope: "Browser image-load event timings; not physical camera FPS",
        configuredDwellMs: 1000,
        intervalsMs: intervals,
      },
      null,
      2,
    ),
  );
});

test("browser WASM parity reconstructs a binary file from one data QR and two parity QRs", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  try {
    const a = await ac.newPage(),
      b = await bc.newPage();
    await open(a);
    await open(b, true);
    await a.getByLabel("Optical content type").selectOption("file");
    await a.getByLabel("Compress only when smaller").uncheck();
    let seed = 9876;
    const bytes = Buffer.from(
      Array.from({ length: 1000 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed & 255;
      }),
    );
    await a.getByLabel("Small optical file (64 KiB maximum)").setInputFiles({
      name: "fec-browser.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    await a
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    await expect(
      a.getByAltText("Optical frame 1 of 5", { exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Pause frames", exact: true }).click();
    for (let i = 0; i < 5; i++) {
      await expect(
        a.getByAltText(`Optical frame ${i + 1} of 5`, { exact: true }),
      ).toBeVisible();
      if ([1, 3, 4].includes(i))
        await upload(b, await png(a, /^Optical frame /));
      if (i < 4)
        await a
          .getByRole("button", { name: "Next frame", exact: true })
          .click();
    }
    await expect(b.getByRole("status")).toContainText(
      "Completed · SHA-256 verified",
    );
    await expect(b.getByText(/Recovered 2/).last()).toBeVisible();
    const download = b.waitForEvent("download");
    await b
      .getByRole("button", { name: "Download reconstructed file", exact: true })
      .click();
    expect(await readFile((await (await download).path())!)).toEqual(bytes);
  } finally {
    await ac.close();
    await bc.close();
  }
});

for (const fallback of [false, true]) {
  test(`QR fullscreen ${fallback ? "fallback" : "native"} toggles without resetting transfer`, async ({
    page,
  }) => {
    await open(page);
    await page
      .getByLabel("Optical text", { exact: true })
      .fill("Fullscreen integrity");
    await page
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    const qr = page.getByAltText(/Optical frame 1 of/);
    await expect(qr).toBeVisible();
    const original = await qr.getAttribute("src");
    if (fallback)
      await page.evaluate(() => {
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
          configurable: true,
          value: () => Promise.reject(new Error("Unavailable")),
        });
      });
    await page
      .getByRole("button", { name: "Fullscreen QR", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Exit Fullscreen", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Exit Fullscreen", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Fullscreen QR", exact: true }),
    ).toBeVisible();
    await expect(qr).toHaveAttribute("src", original!);
    await page
      .getByRole("button", { name: "Fullscreen QR", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Exit Fullscreen", exact: true }),
    ).toBeVisible();
    const nativeActive = await page.evaluate(
      () => !!document.fullscreenElement,
    );
    if (nativeActive) await page.evaluate(() => document.exitFullscreen());
    else await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Fullscreen QR", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "How It Works", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "How Optical Share works" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
}

test("stalled decoder restarts without discarding received frames", async ({
  browser,
}) => {
  const sender = await browser.newContext(),
    receiver = await browser.newContext();
  try {
    const a = await sender.newPage(),
      b = await receiver.newPage();
    let workers = 0;
    await b.route("**/optical-decoder.worker-*.js", async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      if (workers++ === 0)
        body +=
          ";const originalDecode=self.onmessage;let jobs=0;self.onmessage=(event)=>{if(++jobs!==2)originalDecode(event)};";
      await route.fulfill({ response, body });
    });
    await b.clock.install();
    await open(a);
    await open(b, true);
    await a.getByLabel("Compress only when smaller").uncheck();
    await a.getByLabel("Parity per 8 data frames").selectOption("0");
    const message = "0123456789".repeat(70);
    await a.getByLabel("Optical text", { exact: true }).fill(message);
    await a
      .getByRole("button", { name: "Start Transfer", exact: true })
      .click();
    await a.getByRole("button", { name: "Pause frames", exact: true }).click();
    const first = await png(a, /Optical frame 1 of 2/);
    await a.getByRole("button", { name: "Next frame", exact: true }).click();
    await expect(a.getByAltText("Optical frame 2 of 2")).toBeVisible();
    const second = await png(a, /Optical frame 2 of 2/);
    await upload(b, first);
    await expect(b.locator(".optical-panel")).toHaveAttribute(
      "data-optical-received",
      "1",
    );
    await b
      .getByLabel("Import QR frame image (camera-free fallback)", {
        exact: true,
      })
      .setInputFiles({
        name: "second.png",
        mimeType: "image/png",
        buffer: second,
      });
    await b.clock.fastForward(12000);
    await expect(b.getByText(/Decoder took too long/)).toBeVisible();
    await expect(b.locator(".optical-panel")).toHaveAttribute(
      "data-optical-received",
      "1",
    );
    await expect(
      b.getByText("Decoder ready · processing runs in a Web Worker", {
        exact: true,
      }),
    ).toBeVisible();
    await upload(b, second);
    await expect(
      b.getByText("Completed · SHA-256 verified; ready to copy or download", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await sender.close();
    await receiver.close();
  }
});
