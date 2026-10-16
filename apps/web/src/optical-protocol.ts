import { hashFile } from "./hash";
import { encode, decode } from "./crypto";
export type OpticalPayload = {
  kind: "text" | "file";
  blob: Blob;
  text?: string;
  name: string;
  mime: string;
  sha256?: string;
};
type Frame = {
  v: 1 | 2;
  name?: string;
  mime?: string;
  size?: number;
  id: string;
  i: number;
  n: number;
  hash: string;
  data: string;
};
function safeName(value: string) {
  const cleaned = Array.from(value, (char) =>
    char === "/" ||
    char === "\\" ||
    char.charCodeAt(0) < 32 ||
    char.charCodeAt(0) === 127
      ? "_"
      : char,
  )
    .join("")
    .slice(0, 100);
  return !cleaned || cleaned === "." || cleaned === ".."
    ? "optical.bin"
    : cleaned;
}
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
export async function fileFramesFor(file: File): Promise<string[]> {
  if (file.size > 65536)
    throw new Error("Optical files are limited to 64 KiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = encode(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashFile(file),
    n = Math.max(1, Math.ceil(bytes.length / 200));
  const name = safeName(file.name);
  return Array.from({ length: n }, (_, i) =>
    JSON.stringify({
      v: 2,
      id,
      i,
      n,
      hash,
      name,
      mime: "application/octet-stream",
      size: file.size,
      data: encode(bytes.slice(i * 200, (i + 1) * 200)),
    }),
  );
}
export class OpticalCollector {
  private metadata?: Frame;
  private chunks = new Map<number, Uint8Array<ArrayBuffer>>();
  private duplicates = 0;
  get progress() {
    const total = this.metadata?.n || 0;
    return {
      received: this.chunks.size,
      total,
      duplicates: this.duplicates,
      missing: Array.from({ length: total }, (_, i) => i).filter(
        (i) => !this.chunks.has(i),
      ),
    };
  }
  async add(raw: string): Promise<string | undefined> {
    const payload = await this.addPayload(raw);
    if (payload?.kind === "file")
      throw new Error("Use binary optical receiver");
    return payload?.text;
  }
  async addPayload(raw: string): Promise<OpticalPayload | undefined> {
    if (raw.length > 1000) throw new Error("Oversized frame");
    const frame = JSON.parse(raw) as Frame;
    if (
      !frame ||
      typeof frame !== "object" ||
      (frame.v !== 1 && frame.v !== 2) ||
      typeof frame.id !== "string" ||
      !/^[A-Za-z0-9_-]{22}$/.test(frame.id) ||
      !Number.isInteger(frame.n) ||
      frame.n < 1 ||
      frame.n > (frame.v === 1 ? 82 : 328) ||
      !Number.isInteger(frame.i) ||
      frame.i < 0 ||
      frame.i >= frame.n ||
      !/^[a-f0-9]{64}$/.test(frame.hash) ||
      typeof frame.data !== "string"
    )
      throw new Error("Invalid optical frame");
    if (
      frame.v === 2 &&
      (typeof frame.name !== "string" ||
        !frame.name ||
        frame.name.length > 100 ||
        safeName(frame.name) !== frame.name ||
        frame.mime !== "application/octet-stream" ||
        !Number.isInteger(frame.size) ||
        frame.size! < 0 ||
        frame.size! > 65536 ||
        frame.n !== Math.max(1, Math.ceil(frame.size! / 200)))
    )
      throw new Error("Invalid optical file metadata");
    if (!/^[A-Za-z0-9_-]*$/.test(frame.data))
      throw new Error("Invalid frame encoding");
    const bytes = decode(frame.data);
    if (bytes.length > 200 || (frame.i < frame.n - 1 && bytes.length !== 200))
      throw new Error("Invalid frame length");
    if (
      this.metadata &&
      (frame.id !== this.metadata.id ||
        frame.hash !== this.metadata.hash ||
        frame.n !== this.metadata.n ||
        frame.v !== this.metadata.v ||
        frame.name !== this.metadata.name ||
        frame.size !== this.metadata.size ||
        frame.mime !== this.metadata.mime)
    )
      throw new Error(
        "A different transfer is already being received. Reset first.",
      );
    this.metadata = frame;
    const previous = this.chunks.get(frame.i);
    if (previous && encode(previous) !== frame.data)
      throw new Error("Conflicting duplicate");
    if (previous) this.duplicates++;
    this.chunks.set(frame.i, bytes);
    if (this.chunks.size !== frame.n) return;
    const result = new Blob(
      Array.from({ length: frame.n }, (_, i) => this.chunks.get(i)!),
    );
    if (
      result.size > (frame.v === 1 ? 16384 : 65536) ||
      (frame.v === 2 && result.size !== frame.size)
    )
      throw new Error("Invalid optical payload size");
    if ((await hashFile(result)) !== frame.hash)
      throw new Error("Optical checksum mismatch");
    if (frame.v === 2)
      return {
        kind: "file",
        blob: result,
        name: frame.name!,
        mime: frame.mime!,
        sha256: frame.hash,
      };
    return {
      kind: "text",
      blob: result,
      name: "optical.txt",
      mime: "text/plain",
      sha256: frame.hash,
      text: new TextDecoder("utf-8", { fatal: true }).decode(
        await result.arrayBuffer(),
      ),
    };
  }
}
