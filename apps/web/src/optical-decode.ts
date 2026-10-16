import jsQR from "jsqr";
/** Try at most three image scales. Small scale changes avoid decoder sampling aliasing. */
export function decodeOpticalQr(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let passes = 0;
  for (const ratio of [1, 0.75, 0.5]) {
    const w = Math.max(1, Math.round(width * ratio)),
      h = Math.max(1, Math.round(height * ratio));
    if (Math.min(w, h) < 120 && ratio !== 1) continue;
    let sampled = pixels;
    if (ratio !== 1) {
      sampled = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const source =
              (Math.min(height - 1, Math.floor((y + 0.5) / ratio)) * width +
                Math.min(width - 1, Math.floor((x + 0.5) / ratio))) *
              4,
            target = (y * w + x) * 4;
          sampled[target] = pixels[source];
          sampled[target + 1] = pixels[source + 1];
          sampled[target + 2] = pixels[source + 2];
          sampled[target + 3] = 255;
        }
    }
    passes++;
    const frame = jsQR(sampled, w, h, { inversionAttempts: "dontInvert" });
    if (frame) return { frame, passes };
  }
  return { frame: null, passes };
}
