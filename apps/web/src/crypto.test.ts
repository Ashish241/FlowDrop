import { describe, it, expect } from "vitest";
import { importKey, seal, open, nonce } from "./crypto";
describe("AES-GCM chunk envelope", () => {
  it("round trips and rejects tampering, order, and count changes", async () => {
    const key = await importKey(crypto.getRandomValues(new Uint8Array(32))),
      prefix = crypto.getRandomValues(new Uint8Array(8));
    const encrypted = await seal(
      key,
      prefix,
      "share-id",
      1,
      3,
      new TextEncoder().encode("hello").buffer,
    );
    expect(
      new TextDecoder().decode(
        await open(key, prefix, "share-id", 1, 3, encrypted),
      ),
    ).toBe("hello");
    await expect(
      open(key, prefix, "share-id", 2, 3, encrypted),
    ).rejects.toThrow();
    await expect(
      open(key, prefix, "share-id", 1, 4, encrypted),
    ).rejects.toThrow();
    const corrupt = new Uint8Array(encrypted);
    corrupt[0] ^= 1;
    await expect(
      open(key, prefix, "share-id", 1, 3, corrupt.buffer),
    ).rejects.toThrow();
  });
  it("reserves distinct nonces for metadata and all chunks", () => {
    const prefix = new Uint8Array(8);
    expect(nonce(prefix, 0)).not.toEqual(nonce(prefix, 1));
    expect(() => nonce(prefix, -1)).toThrow();
    expect(() => nonce(prefix, 2 ** 32)).toThrow();
  });
});
