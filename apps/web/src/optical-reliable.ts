import { ReedSolomonErasure } from "@digitaldefiance/reed-solomon-erasure.wasm/browser";
import wasm from "@digitaldefiance/reed-solomon-erasure.wasm/wasm?url&inline";
import { hashFile } from "./hash";
import { OpticalCollector, type OpticalPayload } from "./optical-protocol";
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
export function base45(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    let n = i + 1 < bytes.length ? bytes[i] * 256 + bytes[i + 1] : bytes[i];
    out += alphabet[n % 45];
    n = Math.floor(n / 45);
    out += alphabet[n % 45];
    if (i + 1 < bytes.length) out += alphabet[Math.floor(n / 45)];
  }
  return out;
}
export function unbase45(text: string): Uint8Array {
  if (text.length % 3 === 1 || text.length > 2600)
    throw Error("Invalid optical encoding");
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 3) {
    const group = text.slice(i, i + 3);
    const values = [...group].map((c) => alphabet.indexOf(c));
    if (values.some((v) => v < 0)) throw Error("Invalid optical encoding");
    const n = values[0] + 45 * values[1] + (values[2] ?? 0) * 2025;
    if (group.length === 3) {
      if (n > 65535) throw Error("Invalid optical encoding");
      out.push(n >> 8, n & 255);
    } else {
      if (n > 255) throw Error("Invalid optical encoding");
      out.push(n);
    }
  }
  return Uint8Array.from(out);
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function checked(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.length + 4);
  out.set(bytes);
  new DataView(out.buffer).setUint32(bytes.length, crc32(bytes));
  return out;
}
function verify(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      bytes.length - 4,
    ) !== crc32(bytes.subarray(0, -4))
  )
    throw Error("Invalid frame checksum; keep scanning or request recovery.");
  return bytes.subarray(0, -4);
}
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
let rs: ReedSolomonErasure | undefined;
function fec() {
  if (!rs) {
    const raw = atob(wasm.split(",")[1]);
    rs = ReedSolomonErasure.fromBytes(
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    );
  }
  return rs;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function opticalCaptureSize(
  width: number,
  height: number,
  maximum: number,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  )
    throw Error("Camera has no usable video dimensions");
  const bound = Math.min(1280, maximum),
    scale = Math.min(1, bound / width, bound / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
function safeName(name: string) {
  let cleaned = "";
  for (const c of name) {
    const safe =
      c === "/" || c === "\\" || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
        ? "_"
        : c;
    if (encoder.encode(cleaned + safe).length <= 100) cleaned += safe;
  }
  return !cleaned || cleaned === "." || cleaned === ".."
    ? "optical.bin"
    : cleaned;
}
export type OpticalMeta = {
  id: string;
  kind: "file" | "text";
  size: number;
  encodedSize: number;
  chunkSize: number;
  count: number;
  parity: number;
  compressed: boolean;
  name: string;
  mime: string;
  hash: string;
};
export type OpticalTransfer = {
  meta: OpticalMeta;
  frames: string[];
  generationMs: number;
};
export type OpticalFrame = {
  meta: OpticalMeta;
  index: number;
  payload: Uint8Array<ArrayBuffer>;
};
const totalFor = (m: OpticalMeta) =>
  m.count + Math.ceil(m.count / 8) * m.parity;
function encodeFrame(meta: OpticalMeta, index: number, payload: Uint8Array) {
  const name = encoder.encode(meta.name),
    mime = encoder.encode(meta.mime);
  const bytes = new Uint8Array(69 + name.length + mime.length + payload.length),
    v = new DataView(bytes.buffer);
  bytes[0] = 3;
  bytes[1] = (meta.kind === "text" ? 1 : 0) | (meta.compressed ? 2 : 0);
  bytes.set(
    Uint8Array.from(meta.id.match(/../g)!, (s) => parseInt(s, 16)),
    2,
  );
  v.setUint32(18, meta.size);
  v.setUint32(22, meta.encodedSize);
  v.setUint16(26, meta.chunkSize);
  v.setUint16(28, meta.count);
  bytes[30] = meta.parity;
  v.setUint16(31, index);
  v.setUint16(33, payload.length);
  bytes[35] = name.length;
  bytes[36] = mime.length;
  bytes.set(
    Uint8Array.from(meta.hash.match(/../g)!, (s) => parseInt(s, 16)),
    37,
  );
  bytes.set(name, 69);
  bytes.set(mime, 69 + name.length);
  bytes.set(payload, 69 + name.length + mime.length);
  return "FD3:" + base45(checked(bytes));
}
export function parseOpticalFrame(raw: string): OpticalFrame {
  if (!raw.startsWith("FD3:")) throw Error("Not an optical v3 frame");
  const bytes = verify(unbase45(raw.slice(4)));
  if (bytes.length < 69 || bytes[0] !== 3 || (bytes[1] & ~3) !== 0)
    throw Error("Invalid optical header");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    size = v.getUint32(18),
    encodedSize = v.getUint32(22),
    chunkSize = v.getUint16(26),
    count = v.getUint16(28),
    parity = bytes[30],
    index = v.getUint16(31),
    length = v.getUint16(33),
    nameLen = bytes[35],
    mimeLen = bytes[36];
  if (
    size > (bytes[1] & 1 ? 16384 : 65536) ||
    encodedSize > 65536 ||
    ![200, 400, 600, 800].includes(chunkSize) ||
    ![0, 1, 2, 4].includes(parity) ||
    count !== Math.max(1, Math.ceil(encodedSize / chunkSize)) ||
    nameLen < 1 ||
    nameLen > 100 ||
    mimeLen > 64 ||
    bytes.length !== 69 + nameLen + mimeLen + length
  )
    throw Error("Invalid optical metadata");
  const name = decoder.decode(bytes.slice(69, 69 + nameLen)),
    mime = decoder.decode(bytes.slice(69 + nameLen, 69 + nameLen + mimeLen));
  if (safeName(name) !== name) throw Error("Invalid optical filename");
  const meta: OpticalMeta = {
    id: hex(bytes.slice(2, 18)),
    kind: bytes[1] & 1 ? "text" : "file",
    size,
    encodedSize,
    chunkSize,
    count,
    parity,
    compressed: !!(bytes[1] & 2),
    name,
    mime,
    hash: hex(bytes.slice(37, 69)),
  };
  if (
    index >= totalFor(meta) ||
    length !==
      (index < count
        ? Math.min(chunkSize, Math.max(0, encodedSize - index * chunkSize))
        : chunkSize)
  )
    throw Error("Invalid frame index or length");
  return { meta, index, payload: bytes.slice(69 + nameLen + mimeLen) };
}
export async function buildOpticalTransfer(
  blob: Blob,
  name: string,
  kind: "file" | "text",
  options: { chunkSize?: number; parity?: number; compress?: boolean } = {},
): Promise<OpticalTransfer> {
  const start = performance.now();
  if (blob.size > (kind === "text" ? 16384 : 65536))
    throw Error("Optical text limit 16 KiB; file limit 64 KiB.");
  const original = new Uint8Array(await blob.arrayBuffer());
  let bytes = original,
    compressed = false;
  if (
    options.compress !== false &&
    typeof CompressionStream !== "undefined" &&
    original.length > 200
  ) {
    const zip = new Uint8Array(
      await new Response(
        new Blob([original])
          .stream()
          .pipeThrough(new CompressionStream("gzip")),
      ).arrayBuffer(),
    );
    if (zip.length + 64 < original.length) {
      bytes = zip;
      compressed = true;
    }
  }
  const chunkSize = options.chunkSize ?? 400,
    requestedParity = options.parity ?? 2,
    parity = bytes.length <= chunkSize ? 0 : requestedParity;
  if (
    ![200, 400, 600, 800].includes(chunkSize) ||
    ![0, 1, 2, 4].includes(parity)
  )
    throw Error("Unsupported optical density/parity");
  const meta: OpticalMeta = {
    id: hex(crypto.getRandomValues(new Uint8Array(16))),
    kind,
    size: original.length,
    encodedSize: bytes.length,
    chunkSize,
    count: Math.max(1, Math.ceil(bytes.length / chunkSize)),
    parity,
    compressed,
    name: safeName(name),
    mime: kind === "text" ? "text/plain" : "application/octet-stream",
    hash: await hashFile(new Blob([original])),
  };
  const frames = Array.from({ length: meta.count }, (_, i) =>
    encodeFrame(meta, i, bytes.slice(i * chunkSize, (i + 1) * chunkSize)),
  );
  if (parity)
    for (let block = 0; block < Math.ceil(meta.count / 8); block++) {
      const start = block * 8,
        data = Math.min(8, meta.count - start),
        shards = new Uint8Array((data + parity) * chunkSize);
      for (let i = 0; i < data; i++)
        shards.set(
          bytes.slice((start + i) * chunkSize, (start + i + 1) * chunkSize),
          i * chunkSize,
        );
      if (fec().encode(shards, data, parity) !== 0)
        throw Error("Optical parity encoding failed");
      for (let p = 0; p < parity; p++)
        frames.push(
          encodeFrame(
            meta,
            meta.count + block * parity + p,
            shards.slice((data + p) * chunkSize, (data + p + 1) * chunkSize),
          ),
        );
    }
  return { meta, frames, generationMs: performance.now() - start };
}
export type OpticalProgress = {
  received: number;
  total: number;
  missing: number[];
  duplicates: number;
  invalid: number;
  mixed: number;
  recovered: number;
  percent: number;
  id?: string;
  storedBytes: number;
};
export class ReliableOpticalCollector {
  private legacy = new OpticalCollector();
  private meta?: OpticalMeta;
  private frames = new Map<number, Uint8Array<ArrayBuffer>>();
  private result?: OpticalPayload;
  private invalid = 0;
  private mixed = 0;
  private duplicates = 0;
  private recovered = new Set<number>();
  private verified = false;
  get progress(): OpticalProgress {
    if (!this.meta) {
      const p = this.legacy.progress;
      return {
        ...p,
        invalid: this.invalid,
        mixed: this.mixed,
        recovered: 0,
        percent: p.total ? (100 * p.received) / p.total : 0,
        storedBytes: 0,
      };
    }
    const m = this.meta,
      missing = Array.from({ length: m.count }, (_, i) => i).filter(
        (i) => !this.frames.has(i),
      );
    return {
      id: m.id,
      received: m.count - missing.length,
      total: m.count,
      missing,
      duplicates: this.duplicates,
      invalid: this.invalid,
      mixed: this.mixed,
      recovered: this.recovered.size,
      percent: (100 * (m.count - missing.length)) / m.count,
      storedBytes: [...this.frames.values()].reduce(
        (sum, b) => sum + b.length,
        0,
      ),
    };
  }
  async addPayload(raw: string): Promise<OpticalPayload | undefined> {
    try {
      if (!raw.startsWith("FD3:")) {
        if (this.meta) {
          this.mixed++;
          throw Error("Different transfer. Reset only to start another file.");
        }
        return await this.legacy.addPayload(raw);
      }
      if (this.legacy.progress.total) {
        this.mixed++;
        throw Error("Different transfer. Reset only to start another file.");
      }
      const frame = parseOpticalFrame(raw),
        m = frame.meta;
      if (this.meta && JSON.stringify(m) !== JSON.stringify(this.meta)) {
        this.mixed++;
        throw Error(
          "Different transfer. Existing data kept; reset to switch files.",
        );
      }
      this.meta = m;
      const before = this.frames.get(frame.index);
      if (before) {
        if (hex(before) !== hex(frame.payload))
          throw Error("Conflicting duplicate frame");
        this.duplicates++;
        return this.result;
      }
      this.frames.set(frame.index, frame.payload);
      if (m.parity) {
        for (let block = 0; block < Math.ceil(m.count / 8); block++) {
          const start = block * 8,
            data = Math.min(8, m.count - start),
            indexes = Array.from({ length: data }, (_, i) => start + i).concat(
              Array.from(
                { length: m.parity },
                (_, p) => m.count + block * m.parity + p,
              ),
            );
          if (
            indexes.slice(0, data).every((i) => this.frames.has(i)) ||
            indexes.filter((i) => this.frames.has(i)).length < data
          )
            continue;
          const shards = new Uint8Array((data + m.parity) * m.chunkSize),
            present = indexes.map((index, i) => {
              const b = this.frames.get(index);
              if (b) shards.set(b, i * m.chunkSize);
              return !!b;
            });
          if (fec().reconstruct(shards, data, m.parity, present) !== 0)
            continue;
          for (let i = 0; i < data; i++)
            if (!this.frames.has(start + i)) {
              const length = Math.min(
                m.chunkSize,
                Math.max(0, m.encodedSize - (start + i) * m.chunkSize),
              );
              this.frames.set(
                start + i,
                shards.slice(i * m.chunkSize, i * m.chunkSize + length),
              );
              this.recovered.add(start + i);
            }
        }
      }
      if (this.progress.missing.length) return;
      const encoded = new Blob(
        Array.from({ length: m.count }, (_, i) => this.frames.get(i)!),
      );
      let blob = encoded;
      if (m.compressed) {
        if (typeof DecompressionStream === "undefined")
          throw Error(
            "This browser cannot decompress this transfer. Ask sender to disable compression.",
          );
        const reader = encoded
          .stream()
          .pipeThrough(new DecompressionStream("gzip"))
          .getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > m.size || size > 65536)
              throw Error("Decompressed payload exceeds declared limit");
            chunks.push(new Uint8Array(value));
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        blob = new Blob(chunks);
      }
      if (blob.size !== m.size || (await hashFile(blob)) !== m.hash) {
        this.verified = false;
        throw Error(
          "Optical checksum mismatch. Reset and retransmit; no download is available.",
        );
      }
      this.verified = true;
      this.result = {
        kind: m.kind,
        blob,
        name: m.name,
        mime: m.mime,
        sha256: m.hash,
        ...(m.kind === "text"
          ? { text: decoder.decode(await blob.arrayBuffer()) }
          : {}),
      };
      return this.result;
    } catch (error) {
      this.invalid++;
      throw error;
    }
  }
  get complete() {
    return this.verified;
  }
}
export type RecoveryRequest = {
  id: string;
  count: number;
  part: number;
  parts: number;
  missing: number[];
  rate: number;
};
export function recoveryFrames(progress: OpticalProgress, rate = 0) {
  if (!progress.id || !progress.missing.length)
    throw Error("No missing v3 frames to recover");
  const parts = Math.ceil(progress.missing.length / 128);
  return Array.from({ length: parts }, (_, part) => {
    const missing = progress.missing.slice(part * 128, (part + 1) * 128),
      bytes = new Uint8Array(24 + missing.length * 2),
      v = new DataView(bytes.buffer);
    bytes.set(
      Uint8Array.from(progress.id!.match(/../g)!, (s) => parseInt(s, 16)),
    );
    v.setUint16(16, progress.total);
    bytes[18] = part;
    bytes[19] = parts;
    v.setUint16(20, Math.min(65535, Math.max(0, Math.round(rate * 100))));
    v.setUint16(22, missing.length);
    missing.forEach((id, i) => v.setUint16(24 + i * 2, id));
    return "FDR3:" + base45(checked(bytes));
  });
}
export function parseRecovery(raw: string): RecoveryRequest {
  if (!raw.startsWith("FDR3:")) throw Error("Not a recovery request");
  const bytes = verify(unbase45(raw.slice(5)));
  if (bytes.length < 24) throw Error("Invalid recovery request");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = v.getUint16(16),
    part = bytes[18],
    parts = bytes[19],
    n = v.getUint16(22);
  if (
    count < 1 ||
    count > 328 ||
    parts < 1 ||
    parts > 3 ||
    part >= parts ||
    n < 1 ||
    n > 128 ||
    bytes.length !== 24 + n * 2
  )
    throw Error("Invalid recovery request");
  const missing = Array.from({ length: n }, (_, i) => v.getUint16(24 + i * 2));
  if (new Set(missing).size !== n || missing.some((i) => i >= count))
    throw Error("Invalid missing-frame IDs");
  return {
    id: hex(bytes.slice(0, 16)),
    count,
    part,
    parts,
    missing,
    rate: v.getUint16(20) / 100,
  };
}
export function selectiveFrames(
  transfer: OpticalTransfer,
  requests: RecoveryRequest[],
) {
  if (
    !requests.length ||
    requests.some(
      (r) =>
        r.id !== transfer.meta.id ||
        r.count !== transfer.meta.count ||
        r.parts !== requests[0].parts,
    ) ||
    new Set(requests.map((r) => r.part)).size !== requests[0].parts
  )
    throw Error("Recovery request incomplete or for a different transfer");
  return [...new Set(requests.flatMap((r) => r.missing))]
    .sort((a, b) => a - b)
    .map((i) => transfer.frames[i]);
}
export function manualMissing(input: string, count: number) {
  const values = new Set<number>();
  if (input.length > 3000) throw Error("Recovery input too long");
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw Error("Use frame numbers such as 1,4-8");
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count)
      throw Error("Missing-frame number out of range");
    for (let i = start; i <= end; i++) values.add(i - 1);
  }
  return [...values].sort((a, b) => a - b);
}
