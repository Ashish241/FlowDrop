import { it, expect } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { decodeOpticalQr } from "./optical-decode";
import { writeFile, mkdir } from "node:fs/promises";
import {
  buildOpticalTransfer,
  ReliableOpticalCollector,
  recoveryFrames,
  parseRecovery,
  selectiveFrames,
  parseOpticalFrame,
} from "./optical-reliable";
import { fileFramesFor } from "./optical-protocol";
function fixture() {
  let n = 742519;
  return Uint8Array.from({ length: 65536 }, () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return n & 255;
  });
}
function raster(raw: string, width: number, blur = false) {
  const qr = QRCode.create(raw, { errorCorrectionLevel: "M" }),
    modules = qr.modules.size,
    quiet = 4,
    total = modules + 8,
    pixels = new Uint8ClampedArray(width * width * 4);
  pixels.fill(255);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const mx = Math.floor((x * total) / width) - quiet,
        my = Math.floor((y * total) / width) - quiet;
      const value =
        mx >= 0 &&
        my >= 0 &&
        mx < modules &&
        my < modules &&
        qr.modules.data[my * modules + mx]
          ? 0
          : 255;
      const offset = (y * width + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    }
  if (blur) {
    const copy = pixels.slice();
    for (let y = 1; y < width - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const o = (y * width + x) * 4;
        let sum = copy[o] * 4;
        for (const shift of [-4, 4, -width * 4, width * 4])
          sum += copy[o + shift];
        const v = Math.round(sum / 8);
        pixels[o] = pixels[o + 1] = pixels[o + 2] = v;
      }
  }
  return { pixels, version: qr.version, modules };
}
it("measures 200/400/600/800-byte QR capacity and actual raster decoder performance", async () => {
  const bytes = fixture(),
    file = new File([bytes], "64k-regression.bin"),
    legacy = await fileFramesFor(file),
    rows = [];
  for (const chunkSize of [200, 400, 600, 800]) {
    const transfer = await buildOpticalTransfer(file, file.name, "file", {
      chunkSize,
      compress: false,
      parity: 2,
    });
    const samples = [
      0,
      3,
      Math.floor(transfer.meta.count / 2),
      transfer.meta.count - 1,
    ];
    const captures = [];
    for (const [width, blur] of [
      [600, false],
      [360, false],
      [240, true],
    ] as const) {
      let decoded = 0,
        primaryDecoded = 0,
        primaryMs = 0,
        totalMs = 0;
      for (const index of samples) {
        const raw = transfer.frames[index],
          image = raster(raw, width, blur);
        const primaryStart = performance.now();
        const primary = jsQR(image.pixels, width, width, {
          inversionAttempts: "dontInvert",
        });
        primaryMs += performance.now() - primaryStart;
        if (primary?.data === raw) primaryDecoded++;
        const fallbackStart = performance.now();
        const { frame: result } = decodeOpticalQr(image.pixels, width, width);
        totalMs += performance.now() - fallbackStart;
        if (result?.data === raw) decoded++;
      }
      captures.push({
        width,
        blur,
        decoded,
        samples: samples.length,
        meanDecodeMs: totalMs / samples.length,
        primaryDecoded,
        meanPrimaryMs: primaryMs / samples.length,
      });
    }
    const headerBytes =
      69 +
      new TextEncoder().encode(transfer.meta.name).length +
      new TextEncoder().encode(transfer.meta.mime).length +
      4;
    rows.push({
      chunkSize,
      dataFrames: transfer.meta.count,
      parityFrames: transfer.frames.length - transfer.meta.count,
      totalFrames: transfer.frames.length,
      rawBinaryHeaderBytes: headerBytes,
      qrCharacters: transfer.frames[0].length,
      qrVersion: QRCode.create(transfer.frames[0], {
        errorCorrectionLevel: "M",
      }).version,
      errorCorrection: "M",
      quietZoneModules: 4,
      captures,
      oneCycleEstimateSeconds: transfer.frames.length,
    });
    expect(captures[0].samples).toBe(samples.length);
  }
  const report = {
    scope:
      "Synthetic QR raster sampling on this PC; not a physical camera benchmark",
    originalBytes: bytes.length,
    legacy: {
      frames: legacy.length,
      firstQrCharacters: legacy[0].length,
      firstQrVersion: QRCode.create(legacy[0], { errorCorrectionLevel: "M" })
        .version,
      payloadBytes: 200,
      encoding: "JSON + Base64url",
      oneCycleEstimateSeconds: legacy.length * 0.6,
    },
    candidates: rows,
    default:
      "400-byte conservative profile; verify on actual phones before increasing density",
  };
  await mkdir("../../.flowdrop", { recursive: true });
  await writeFile(
    "../../.flowdrop/optical-benchmark.json",
    JSON.stringify(report, null, 2),
  );
}, 120000);
it("64 KiB actual QR sampling harness survives interrupted repeated scans and selective QR retransmission", async () => {
  const bytes = fixture(),
    transfer = await buildOpticalTransfer(
      new Blob([bytes]),
      "64k.bin",
      "file",
      { chunkSize: 400, parity: 0, compress: false },
    ),
    receiver = new ReliableOpticalCollector();
  let attempts = 0,
    decoded = 0;
  const ingest = async (raw: string) => {
    attempts++;
    const image = raster(raw, 480),
      result = jsQR(image.pixels, 480, 480, {
        inversionAttempts: "dontInvert",
      });
    if (result) {
      decoded++;
      return receiver.addPayload(result.data);
    }
  };
  // Camera samples every other display frame at a fixed phase; a second cycle need not add new data.
  for (let cycle = 0; cycle < 2; cycle++)
    for (let index = 0; index < transfer.frames.length; index += 2)
      await ingest(transfer.frames[index]);
  expect(receiver.progress.missing.length).toBeGreaterThan(0);
  const before = receiver.progress.received;
  const qrRequests = recoveryFrames(receiver.progress).map((raw) => {
    const image = raster(raw, 600),
      result = jsQR(image.pixels, 600, 600, {
        inversionAttempts: "dontInvert",
      });
    expect(result).not.toBeNull();
    return parseRecovery(result!.data);
  });
  const selected = selectiveFrames(transfer, qrRequests);
  expect(selected).toHaveLength(transfer.meta.count - before);
  let complete;
  for (const frame of selected) complete = (await ingest(frame)) || complete;
  expect(new Uint8Array(await complete!.blob.arrayBuffer())).toEqual(bytes);
  expect(receiver.complete).toBe(true);
  await writeFile(
    "../../.flowdrop/optical-sampling.json",
    JSON.stringify(
      {
        scope:
          "Actual raster decoding with phase-locked synthetic sampling; not physical",
        originalBytes: 65536,
        attempts,
        decoded,
        receivedBeforeRecovery: before,
        recoveryFrames: selected.length,
        complete: true,
        sha256: transfer.meta.hash,
        storedPayloadBytes: receiver.progress.storedBytes,
      },
      null,
      2,
    ),
  );
  expect(parseOpticalFrame(transfer.frames[0]).payload.length).toBe(400);
}, 120000);
