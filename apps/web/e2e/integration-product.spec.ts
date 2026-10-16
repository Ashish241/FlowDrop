import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import { fileFramesFor } from "../src/optical-protocol";

test("Coming Soon makes no cloud calls; optical reconstructs real QR images offline", async ({
  page,
  context,
}) => {
  const cloud: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/cloud"))
      cloud.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Send Later — Coming Soon", exact: true })
    .click();
  await expect(
    page
      .getByRole("heading", {
        name: "Send Later — Coming Soon",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  expect(cloud).toEqual([]);
  if (
    await page
      .getByRole("button", { name: "Back to Home", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Back to Home", exact: true })
      .first()
      .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Optical Share", exact: true })
    .click();
  await expect(
    page.getByText("Decoder ready · processing runs in a Web Worker", {
      exact: true,
    }),
  ).toBeVisible();
  await context.setOffline(true);
  const bytes = Buffer.from([
    0,
    255,
    17,
    ...Array.from({ length: 510 }, (_, i) => i % 256),
  ]);
  const frames = await fileFramesFor(new File([bytes], "camera-binary.bin"));
  const upload = page.getByLabel(
    "Import QR frame image (camera-free fallback)",
  );
  const add = async (frame: string) =>
    upload.setInputFiles({
      name: "frame.png",
      mimeType: "image/png",
      buffer: await QRCode.toBuffer(frame, {
        width: 700,
        errorCorrectionLevel: "M",
      }),
    });
  await add(frames[0]);
  await expect(page.getByRole("status")).toContainText("Missing 2");
  await add(frames[0]);
  await expect(page.getByRole("status")).toContainText("Duplicates 1");
  await add(frames[2]);
  await expect(page.getByRole("status")).toContainText("Missing 1");
  await add(frames[1]);
  await expect(page.getByRole("status")).toContainText("SHA-256 verified");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download reconstructed file", exact: true })
    .click();
  expect(await readFile((await (await download).path())!)).toEqual(bytes);
});

test("optical sender controls and denied camera permission have useful states", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Camera permission denied", "NotAllowedError");
        },
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Optical Share", exact: true })
    .click();
  await page
    .getByPlaceholder("Text to display as QR frames")
    .fill("Unicode 🌍 <script>not executable</script>\n".repeat(10));
  await page
    .getByRole("button", { name: "Start Transfer", exact: true })
    .click();
  await expect(page.getByAltText(/Optical frame/)).toBeVisible();
  await page.getByRole("button", { name: "Pause frames", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume frames", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restart frames", exact: true })
    .click();
  await expect(page.getByAltText(/Optical frame 1 of/)).toBeVisible();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("permission denied");
});
