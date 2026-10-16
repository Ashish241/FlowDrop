import { expect, it } from "vitest";
import {
  buildOpticalTransfer,
  ReliableOpticalCollector,
  parseOpticalFrame,
  recoveryFrames,
  parseRecovery,
  selectiveFrames,
  manualMissing,
  base45,
  unbase45,
  crc32,
} from "./optical-reliable";
import { fileFramesFor, OpticalCollector } from "./optical-protocol";
import { hashFile } from "./hash";
const bytesFor = (length: number) => {
  let seed = 123456789;
  return Uint8Array.from({ length }, () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed & 255;
  });
};
const original = bytesFor(65536);
async function same(
  receiver: ReliableOpticalCollector,
  frames: string[],
  bytes: Uint8Array,
) {
  let result;
  for (const frame of frames)
    result = (await receiver.addPayload(frame)) || result;
  expect(result).toBeDefined();
  expect(new Uint8Array(await result!.blob.arrayBuffer())).toEqual(bytes);
  expect(await hashFile(result!.blob)).toBe(
    await hashFile(new Blob([new Uint8Array(bytes)])),
  );
  return result;
}
it("64 KiB baseline produces exactly 328 frames and phase-locked sampling misses the same half after two cycles", async () => {
  const frames = await fileFramesFor(new File([original], "64k.bin"));
  expect(frames).toHaveLength(328);
  const receiver = new OpticalCollector();
  for (let cycle = 0; cycle < 2; cycle++)
    for (let i = 0; i < frames.length; i += 2)
      await receiver.addPayload(frames[i]);
  expect(receiver.progress.received).toBe(164);
  expect(receiver.progress.missing).toHaveLength(164);
});
it("v3 compact encoding, single/multiframe Unicode text, Unicode filename and empty file", async () => {
  expect(unbase45(base45(original.slice(0, 99)))).toEqual(
    original.slice(0, 99),
  );
  for (const [blob, name, kind] of [
    [new Blob(["こんにちは 🌍"]), "optical.txt", "text"],
    [new Blob(["世界".repeat(900)]), "名字.bin", "text"],
    [new Blob([]), "空.bin", "file"],
  ] as const) {
    const transfer = await buildOpticalTransfer(blob, name, kind, {
      compress: false,
    });
    if (blob.size < 400) expect(transfer.frames).toHaveLength(1);
    const value = await same(
      new ReliableOpticalCollector(),
      transfer.frames,
      new Uint8Array(await blob.arrayBuffer()),
    );
    expect(value?.name).toBe(name);
  }
});
it("64 KiB random loss, duplicates, shuffled cycles and QR recovery pages reconstruct original bytes", async () => {
  const transfer = await buildOpticalTransfer(
    new Blob([original]),
    "camera.bin",
    "file",
    { compress: false, parity: 0 },
  );
  expect(transfer.frames).toHaveLength(164);
  const receiver = new ReliableOpticalCollector();
  const kept = transfer.frames
    .filter((_, i) => i % 7 !== 0 && i !== 163)
    .reverse();
  for (let cycle = 0; cycle < 2; cycle++)
    for (const frame of kept) await receiver.addPayload(frame);
  expect(receiver.progress.duplicates).toBe(kept.length);
  expect(receiver.progress.missing).toContain(0);
  expect(receiver.progress.missing).toContain(163);
  const requests = recoveryFrames(receiver.progress, 2.5).map(parseRecovery);
  const selected = selectiveFrames(transfer, requests);
  expect(selected).toHaveLength(receiver.progress.missing.length);
  expect(
    manualMissing(
      receiver.progress.missing.map((i) => i + 1).join(","),
      transfer.meta.count,
    ),
  ).toEqual(receiver.progress.missing);
  await same(receiver, selected, original);
  expect(receiver.progress.missing).toHaveLength(0);
  expect(receiver.progress.storedBytes).toBe(65536);
});
it("RS parity recovers at most configured erasures per group, including first and last data chunks", async () => {
  const transfer = await buildOpticalTransfer(
    new Blob([original]),
    "fec.bin",
    "file",
    { compress: false, parity: 2 },
  );
  expect(transfer.frames).toHaveLength(206);
  const within = transfer.frames.filter(
    (_, i) => i >= transfer.meta.count || i % 8 > 1,
  );
  const receiver = new ReliableOpticalCollector();
  await same(receiver, within.reverse(), original);
  expect(receiver.progress.recovered).toBeGreaterThan(0);
  const beyond = new ReliableOpticalCollector();
  for (const [i, frame] of transfer.frames.entries())
    if (![0, 1, 2].includes(i)) await beyond.addPayload(frame);
  expect(beyond.complete).toBe(false);
  expect(beyond.progress.missing).toEqual([0, 1, 2]);
  await same(
    beyond,
    selectiveFrames(
      transfer,
      recoveryFrames(beyond.progress).map(parseRecovery),
    ),
    original,
  );
});
it("burst-loss interleaving and parity outperform no FEC under the same erasures", async () => {
  for (const parity of [0, 1, 2, 4]) {
    const t = await buildOpticalTransfer(
      new Blob([original]),
      "burst.bin",
      "file",
      { compress: false, parity },
    );
    const lost = new Set(Array.from({ length: 12 }, (_, block) => block * 8));
    const receiver = new ReliableOpticalCollector();
    let result;
    for (const [i, f] of t.frames.entries())
      if (!lost.has(i)) result = (await receiver.addPayload(f)) || result;
    if (parity) {
      expect(result).toBeDefined();
      expect(await hashFile(result!.blob)).toBe(t.meta.hash);
    } else expect(receiver.progress.missing).toHaveLength(12);
  }
});
it("rejects malformed, mixed and conflicting frames; final SHA-256 gates completion", async () => {
  const a = await buildOpticalTransfer(new Blob([original]), "a", "file", {
      parity: 0,
      compress: false,
    }),
    b = await buildOpticalTransfer(new Blob([original]), "b", "file", {
      parity: 0,
      compress: false,
    }),
    receiver = new ReliableOpticalCollector();
  await receiver.addPayload(a.frames[0]);
  await expect(receiver.addPayload(b.frames[0])).rejects.toThrow("Different");
  await expect(receiver.addPayload("FD3:bad!")).rejects.toThrow();
  expect(receiver.progress.received).toBe(1);
  expect(receiver.progress.mixed).toBe(1);
  const raw = unbase45(a.frames[0].slice(4));
  raw[raw.length - 5] ^= 1;
  new DataView(raw.buffer).setUint32(
    raw.length - 4,
    crc32(raw.subarray(0, -4)),
  );
  await expect(receiver.addPayload("FD3:" + base45(raw))).rejects.toThrow(
    "Conflicting",
  );
  const corrupted = new ReliableOpticalCollector();
  for (let i = 0; i < a.frames.length - 1; i++)
    await corrupted.addPayload(i === 0 ? "FD3:" + base45(raw) : a.frames[i]);
  await expect(corrupted.addPayload(a.frames.at(-1)!)).rejects.toThrow(
    "checksum",
  );
  expect(corrupted.complete).toBe(false);
  await expect(
    new ReliableOpticalCollector().addPayload("x".repeat(10000)),
  ).rejects.toThrow();
  expect(() => parseOpticalFrame(a.frames[0].slice(0, -1))).toThrow();
});
it("bounded beneficial gzip and recovery validation", async () => {
  const blob = new Blob(["compressible\n".repeat(4000)]),
    t = await buildOpticalTransfer(blob, "repeat.txt", "file");
  expect(t.meta.compressed).toBe(true);
  expect(t.meta.encodedSize).toBeLessThan(blob.size / 5);
  await same(
    new ReliableOpticalCollector(),
    t.frames,
    new Uint8Array(await blob.arrayBuffer()),
  );
  const x = await buildOpticalTransfer(new Blob([original]), "a", "file", {
      compress: false,
      parity: 0,
    }),
    receiver = new ReliableOpticalCollector();
  await receiver.addPayload(x.frames[2]);
  const requests = recoveryFrames(receiver.progress).map(parseRecovery);
  expect(requests).toHaveLength(2);
  expect(() => selectiveFrames(x, requests.slice(1))).toThrow("incomplete");
  expect(() =>
    selectiveFrames(
      { ...x, meta: { ...x.meta, id: "00".repeat(16) } },
      requests,
    ),
  ).toThrow("different");
  expect(() => manualMissing("1-999", x.meta.count)).toThrow();
  await expect(
    buildOpticalTransfer(new Blob([new Uint8Array(65537)]), "large", "file"),
  ).rejects.toThrow("64 KiB");
});

it("seeded random and burst data loss, shuffled duplicates and repeated cycles recover selectively with FEC comparison", async () => {
  let seed = 832947;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lost = new Set<number>([0, 1, 2, 3, 4, 163]);
  for (let i = 0; i < 164; i++) if (random() < 0.13) lost.add(i);
  const results = [];
  for (const parity of [0, 2]) {
    const t = await buildOpticalTransfer(
      new Blob([original]),
      "loss.bin",
      "file",
      { parity, compress: false },
    );
    const kept = t.frames.filter((_, i) => i >= t.meta.count || !lost.has(i));
    for (let i = kept.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [kept[i], kept[j]] = [kept[j], kept[i]];
    }
    const receiver = new ReliableOpticalCollector();
    for (let cycle = 0; cycle < 2; cycle++)
      for (const frame of kept) await receiver.addPayload(frame);
    const missing = receiver.progress.missing.length,
      recovered = receiver.progress.recovered;
    expect(receiver.complete).toBe(false);
    const selected = selectiveFrames(
      t,
      recoveryFrames(receiver.progress).map(parseRecovery),
    );
    await same(receiver, selected, original);
    expect(receiver.progress.storedBytes).toBeLessThan(200000);
    results.push({
      parity,
      missingBeforeRecovery: missing,
      fecRecovered: recovered,
      selectiveFrames: selected.length,
      verified: true,
    });
  }
  expect(results[1].missingBeforeRecovery).toBeLessThan(
    results[0].missingBeforeRecovery,
  );
  expect(results[1].fecRecovered).toBeGreaterThan(0);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    "../../.flowdrop/optical-fec.json",
    JSON.stringify(
      {
        scope:
          "Seeded synthetic erasures and reordering, not physical camera loss",
        originalBytes: 65536,
        lostDataFrames: lost.size,
        results,
      },
      null,
      2,
    ),
  );
});

it("v3 handles an exact 328-frame 64 KiB transfer without resetting for repeated cycles", async () => {
  const transfer = await buildOpticalTransfer(
    new Blob([original]),
    "328.bin",
    "file",
    { chunkSize: 200, parity: 0, compress: false },
  );
  expect(transfer.frames).toHaveLength(328);
  const receiver = new ReliableOpticalCollector();
  for (const frame of transfer.frames.slice(1, -1).reverse())
    await receiver.addPayload(frame);
  for (const frame of transfer.frames.slice(1, -1))
    await receiver.addPayload(frame);
  expect(receiver.progress.missing).toEqual([0, 327]);
  await same(receiver, [transfer.frames[327], transfer.frames[0]], original);
  expect(receiver.progress.storedBytes).toBe(65536);
});
