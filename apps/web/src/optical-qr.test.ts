import { it, expect } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { framesFor } from "./optical-protocol";
it("decodes an actual QR raster carrying an optical protocol frame", async () => {
  const [frame] = await framesFor("Unicode camera test · こんにちは");
  const qr = QRCode.create(frame, { errorCorrectionLevel: "M" }),
    scale = 4,
    margin = 4,
    width = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  pixels.fill(255);
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++)
      if (qr.modules.data[y * qr.modules.size + x]) {
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const offset =
              (((y + margin) * scale + dy) * width +
                (x + margin) * scale +
                dx) *
              4;
            pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
          }
      }
  expect(jsQR(pixels, width, width)?.data).toBe(frame);
});
