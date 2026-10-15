import { afterEach, expect, it, vi } from "vitest";
import { createStreamSink } from "./stream-sink";
afterEach(() => vi.unstubAllGlobals());
it("buffers bounded files when a browser exposes workers but denies registration", async () => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", {
    serviceWorker: { register: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  const sink = await createStreamSink("bytes.bin", 3);
  expect(sink.buffered).toBe(true);
  await sink.write(new Uint8Array([0, 127, 255]));
  expect(new Uint8Array(await (await sink.close())!.arrayBuffer())).toEqual(
    new Uint8Array([0, 127, 255]),
  );
  await expect(
    createStreamSink("too-big.bin", 129 * 1024 * 1024),
  ).rejects.toThrow("denied");
  await expect(createStreamSink("bad.bin", -1)).rejects.toThrow(
    "Invalid download size",
  );
});
