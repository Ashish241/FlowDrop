export const CHUNK_SIZE = 1048576;
export function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decode(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(text.replace(/-/g, "+").replace(/_/g, "/")),
    (x) => x.charCodeAt(0),
  );
}
export function nonce(
  prefix: Uint8Array,
  index: number,
): Uint8Array<ArrayBuffer> {
  if (
    prefix.length !== 8 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 2 ** 32
  )
    throw new Error("Invalid nonce input");
  const out = new Uint8Array(12);
  out.set(prefix);
  new DataView(out.buffer).setUint32(8, index);
  return out;
}
function aad(id: string, index: number, count: number) {
  return new TextEncoder().encode(
    JSON.stringify({ version: 1, id, index, count }),
  );
}
export async function importKey(raw: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(
  key: CryptoKey,
  prefix: Uint8Array,
  id: string,
  index: number,
  count: number,
  data: ArrayBuffer,
) {
  return crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce(prefix, index),
      additionalData: aad(id, index, count),
      tagLength: 128,
    },
    key,
    data,
  );
}
export async function open(
  key: CryptoKey,
  prefix: Uint8Array,
  id: string,
  index: number,
  count: number,
  data: ArrayBuffer,
) {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce(prefix, index),
      additionalData: aad(id, index, count),
      tagLength: 128,
    },
    key,
    data,
  );
}
