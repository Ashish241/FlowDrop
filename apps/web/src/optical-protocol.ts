import { hashFile } from "./hash";
import { encode, decode } from "./crypto";
type Frame = {
  v: 1;
  id: string;
  i: number;
  n: number;
  hash: string;
  data: string;
};
export async function framesFor(text: string): Promise<string[]> {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 16384)
    throw new Error("Optical text is limited to 16 KiB.");
  const id = encode(crypto.getRandomValues(new Uint8Array(16))),
    hash = await hashFile(new Blob([bytes])),
    n = Math.max(1, Math.ceil(bytes.length / 200));
  return Array.from({ length: n }, (_, i) =>
    JSON.stringify({
      v: 1,
      id,
      i,
      n,
      hash,
      data: encode(bytes.slice(i * 200, (i + 1) * 200)),
    } satisfies Frame),
  );
}
export class OpticalCollector {
  private metadata?: Frame;
  private chunks = new Map<number, Uint8Array<ArrayBuffer>>();
  get progress() {
    return { received: this.chunks.size, total: this.metadata?.n || 0 };
  }
  async add(raw: string): Promise<string | undefined> {
    if (raw.length > 1000) throw new Error("Oversized frame");
    const frame = JSON.parse(raw) as Frame;
    if (
      frame.v !== 1 ||
      typeof frame.id !== "string" ||
      frame.id.length > 80 ||
      !Number.isInteger(frame.n) ||
      frame.n < 1 ||
      frame.n > 82 ||
      !Number.isInteger(frame.i) ||
      frame.i < 0 ||
      frame.i >= frame.n ||
      !/^[a-f0-9]{64}$/.test(frame.hash) ||
      typeof frame.data !== "string"
    )
      throw new Error("Invalid optical frame");
    const bytes = decode(frame.data);
    if (bytes.length > 200 || (frame.i < frame.n - 1 && bytes.length !== 200))
      throw new Error("Invalid frame length");
    if (
      this.metadata &&
      (frame.id !== this.metadata.id ||
        frame.hash !== this.metadata.hash ||
        frame.n !== this.metadata.n)
    )
      throw new Error(
        "A different transfer is already being received. Reset first.",
      );
    this.metadata = frame;
    const previous = this.chunks.get(frame.i);
    if (previous && encode(previous) !== frame.data)
      throw new Error("Conflicting duplicate");
    this.chunks.set(frame.i, bytes);
    if (this.chunks.size !== frame.n) return;
    const result = new Blob(
      Array.from({ length: frame.n }, (_, i) => this.chunks.get(i)!),
    );
    if ((await hashFile(result)) !== frame.hash)
      throw new Error("Optical checksum mismatch");
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await result.arrayBuffer(),
    );
  }
}
