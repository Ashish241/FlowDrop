import { it, expect } from "vitest";
import { framesFor, OpticalCollector } from "./optical-protocol";
it("reassembles Unicode frames out of order with duplicate recovery", async () => {
  const text = "こんにちは\n".repeat(200),
    frames = await framesFor(text),
    receiver = new OpticalCollector();
  await receiver.add(frames[0]);
  await receiver.add(frames[0]);
  let result;
  for (const frame of frames.slice().reverse())
    result = await receiver.add(frame);
  expect(result).toBe(text);
  expect(receiver.progress.received).toBe(frames.length);
});
it("rejects conflicting metadata, malformed input, and checksum corruption", async () => {
  const frames = await framesFor("hello"),
    receiver = new OpticalCollector();
  await expect(receiver.add("{")).rejects.toThrow();
  const broken = JSON.parse(frames[0]);
  broken.data = "YWJj";
  await expect(receiver.add(JSON.stringify(broken))).rejects.toThrow(
    "checksum",
  );
  await expect(framesFor("x".repeat(16385))).rejects.toThrow();
});
