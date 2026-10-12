import { createSHA256 } from "hash-wasm";
export async function hashFile(file: Blob): Promise<string> {
  const hash = await createSHA256();
  hash.init();
  for (let offset = 0; offset < file.size; offset += 1048576) {
    hash.update(
      new Uint8Array(await file.slice(offset, offset + 1048576).arrayBuffer()),
    );
  }
  return hash.digest("hex");
}
