import { afterEach, expect, test, vi } from "vitest";
import { openCamera } from "./camera";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("camera timeout is retryable and closes a late permission stream", async () => {
  vi.useFakeTimers();
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    },
  });
  const pending = openCamera({ video: true }, 100);
  const failure = expect(pending).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(100);
  await failure;
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce();
});
