import { describe, it, expect } from "vitest";
import { hashFile } from "./hash";
describe("streamed SHA-256", () => {
  it("handles empty and known content", async () => {
    expect(await hashFile(new Blob([]))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await hashFile(new Blob(["abc"]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("uses bounded slices", async () => {
    const file = new Blob([new Uint8Array(3 * 1048576 + 1)]);
    const original = file.slice.bind(file);
    let largest = 0;
    file.slice = (start, end) => {
      largest = Math.max(largest, (end || file.size) - (start || 0));
      return original(start, end);
    };
    await hashFile(file);
    expect(largest).toBeLessThanOrEqual(1048576);
  });
});
