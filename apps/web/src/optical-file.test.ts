import { it, expect } from "vitest";
import { fileFramesFor, OpticalCollector } from "./optical-protocol";

it("binary optical recovery tolerates loss, repeats and out-of-order frames", async () => {
  const bytes = Uint8Array.from({ length: 65536 }, (_, i) => i % 256);
  const frames = await fileFramesFor(new File([bytes], "sample.bin"));
  const receiver = new OpticalCollector();
  await receiver.addPayload(frames[0]);
  await receiver.addPayload(frames[0]);
  for (const frame of frames.slice(2).reverse())
    await receiver.addPayload(frame);
  expect(receiver.progress.missing).toEqual([1]);
  expect(receiver.progress.duplicates).toBe(1);
  const result = await receiver.addPayload(frames[1]);
  expect(result?.kind).toBe("file");
  expect(new Uint8Array(await result!.blob.arrayBuffer())).toEqual(bytes);
});
it("rejects oversized files, corrupt payloads and unsafe binary metadata", async () => {
  await expect(
    fileFramesFor(new File([new Uint8Array(65537)], "large")),
  ).rejects.toThrow("64 KiB");
  const [raw] = await fileFramesFor(
    new File([new Uint8Array([0, 255, 17])], "safe.bin"),
  );
  const frame = JSON.parse(raw);
  await expect(
    new OpticalCollector().addPayload(
      JSON.stringify({ ...frame, name: "../evil" }),
    ),
  ).rejects.toThrow("metadata");
  await expect(
    new OpticalCollector().addPayload(
      JSON.stringify({ ...frame, data: "AAAB" }),
    ),
  ).rejects.toThrow("checksum");
  await expect(new OpticalCollector().addPayload("null")).rejects.toThrow();
  await expect(
    new OpticalCollector().addPayload(JSON.stringify({ ...frame, n: 100000 })),
  ).rejects.toThrow();
});
