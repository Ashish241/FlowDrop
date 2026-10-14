import { createSHA256 } from "hash-wasm";
export async function hashFile(
  file: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const hash = await createSHA256();
  hash.init();
  for (let offset = 0; offset < file.size; offset += 1048576) {
    if (signal?.aborted)
      throw new DOMException("Hashing cancelled", "AbortError");
    hash.update(
      new Uint8Array(await file.slice(offset, offset + 1048576).arrayBuffer()),
    );
  }
  if (signal?.aborted)
    throw new DOMException("Hashing cancelled", "AbortError");
  return hash.digest("hex");
}
