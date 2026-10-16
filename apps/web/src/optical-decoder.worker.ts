import { decodeOpticalQr } from "./optical-decode";
self.onmessage = (
  event: MessageEvent<{
    pixels: ArrayBuffer;
    width: number;
    height: number;
    sequence: number;
  }>,
) => {
  const start = performance.now();
  try {
    const { frame, passes } = decodeOpticalQr(
      new Uint8ClampedArray(event.data.pixels),
      event.data.width,
      event.data.height,
    );
    self.postMessage({
      sequence: event.data.sequence,
      raw: frame?.data,
      passes,
      ms: performance.now() - start,
    });
  } catch {
    self.postMessage({
      sequence: event.data.sequence,
      error: "QR decoder failed",
      ms: performance.now() - start,
    });
  }
};
self.postMessage({ ready: true });
