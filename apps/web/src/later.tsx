import { useState } from "react";
import { createStreamSink } from "./stream-sink";
import { CHUNK_SIZE, encode, decode, importKey, seal, open } from "./crypto";
type Share = {
  id: string;
  upload_token: string;
  download_token: string;
  expires: number;
};
export function LaterPanel() {
  const [status, setStatus] = useState(
      "Encryption happens in this browser. The storage service receives ciphertext.",
    ),
    [link, setLink] = useState(""),
    [input, setInput] = useState(
      location.hash.includes("share=") ? location.href : "",
    ),
    [progress, setProgress] = useState(0),
    [ttl, setTtl] = useState(86400),
    [share, setShare] = useState<Share>(),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false);
  const base = "/cloud";
  async function api(path: string, token?: string, options: RequestInit = {}) {
    const r = await fetch(base + path, {
      ...options,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...options.headers,
      },
    });
    if (!r.ok) {
      let detail = "Storage service unavailable";
      try {
        detail = (await r.json()).detail;
      } catch {
        /* Keep the generic message for non-JSON server errors. */
      }
      throw new Error(detail + " (" + r.status + ")");
    }
    return r;
  }
  async function send() {
    if (!file) return;
    setBusy(true);
    try {
      if (!crypto.subtle)
        throw new Error("Encryption requires HTTPS or localhost.");
      const chunks = Math.ceil(file.size / CHUNK_SIZE) + 1;
      const s = (await (
        await api("/shares", undefined, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chunks,
            bytes_limit: file.size + chunks * 16 + 4096,
            ttl,
          }),
        })
      ).json()) as Share;
      setShare(s);
      const raw = crypto.getRandomValues(new Uint8Array(32)),
        prefix = crypto.getRandomValues(new Uint8Array(8)),
        key = await importKey(raw);
      const metadata = new TextEncoder().encode(
        JSON.stringify({
          version: 1,
          name: file.name,
          size: file.size,
          chunks,
        }),
      );
      await api(`/shares/${s.id}/chunks/0`, s.upload_token, {
        method: "PUT",
        body: await seal(key, prefix, s.id, 0, chunks, metadata.buffer),
      });
      for (let index = 1; index < chunks; index++) {
        const bytes = await file
          .slice((index - 1) * CHUNK_SIZE, index * CHUNK_SIZE)
          .arrayBuffer();
        await api(`/shares/${s.id}/chunks/${index}`, s.upload_token, {
          method: "PUT",
          body: await seal(key, prefix, s.id, index, chunks, bytes),
        });
        setProgress((index / (chunks - 1)) * 100);
      }
      await api(`/shares/${s.id}/finish`, s.upload_token, { method: "POST" });
      const fragment = new URLSearchParams({
        share: s.id,
        key: encode(raw),
        nonce: encode(prefix),
        token: s.download_token,
      });
      setLink(location.origin + "/#" + fragment);
      setStatus(
        "Encrypted upload complete. Link expires " +
          new Date(s.expires * 1000).toLocaleString(),
      );
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function receive() {
    setBusy(true);
    try {
      const params = new URLSearchParams(new URL(input).hash.slice(1));
      const id = params.get("share")!,
        token = params.get("token")!,
        prefix = decode(params.get("nonce")!),
        key = await importKey(decode(params.get("key")!));
      const info = await (await api("/shares/" + id, token)).json();
      if (
        !Number.isInteger(info.chunks) ||
        info.chunks < 1 ||
        info.chunks > 20481
      )
        throw new Error("Invalid manifest");
      const metadata = JSON.parse(
        new TextDecoder().decode(
          await open(
            key,
            prefix,
            id,
            0,
            info.chunks,
            await (await api(`/shares/${id}/chunks/0`, token)).arrayBuffer(),
          ),
        ),
      );
      if (
        metadata.version !== 1 ||
        metadata.chunks !== info.chunks ||
        !Number.isSafeInteger(metadata.size) ||
        metadata.size < 0 ||
        Math.ceil(metadata.size / CHUNK_SIZE) + 1 !== info.chunks ||
        typeof metadata.name !== "string"
      )
        throw new Error("Invalid encrypted metadata");
      const sink = await createStreamSink(metadata.name, metadata.size);
      let size = 0;
      try {
        for (let index = 1; index < info.chunks; index++) {
          const encrypted = await (
            await api(`/shares/${id}/chunks/${index}`, token)
          ).arrayBuffer();
          if (encrypted.byteLength > CHUNK_SIZE + 16)
            throw new Error("Oversized encrypted chunk");
          const plain = await open(
            key,
            prefix,
            id,
            index,
            info.chunks,
            encrypted,
          );
          const expected = Math.min(
            CHUNK_SIZE,
            metadata.size - (index - 1) * CHUNK_SIZE,
          );
          if (plain.byteLength !== expected) throw new Error("Incomplete file");
          size += plain.byteLength;
          await sink.write(new Uint8Array(plain));
          setProgress((index / (info.chunks - 1)) * 100);
        }
        if (size !== metadata.size) throw new Error("Incomplete file");
        const blob = await sink.close();
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = metadata.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } catch (e) {
        sink.abort();
        throw e;
      }
      setStatus(
        "Decrypted and authenticated all chunks. Handed to browser downloads.",
      );
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Send Later · encrypted links</h2>
      <p role="status">{status}</p>
      <label>
        File
        <input
          type="file"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <label>
        Expires after
        <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
          <option value={3600}>1 hour</option>
          <option value={86400}>1 day</option>
          <option value={604800}>7 days</option>
        </select>
      </label>
      <button disabled={!file || busy} onClick={() => void send()}>
        Encrypt & upload
      </button>
      <progress max={100} value={progress} />
      {link && (
        <label>
          Secret sharing link (anyone with it can decrypt)
          <textarea readOnly value={link} />
        </label>
      )}
      {share && (
        <button
          disabled={busy}
          onClick={() =>
            void api("/shares/" + share.id, share.upload_token, {
              method: "DELETE",
            })
              .then(() => {
                setLink("");
                setStatus("Revoked and deletion requested.");
              })
              .catch((e) => setStatus(String(e)))
          }
        >
          Revoke share
        </button>
      )}
      <h2>Receive a file</h2>
      <label>
        Paste secret sharing link
        <textarea value={input} onChange={(e) => setInput(e.target.value)} />
      </label>
      <button disabled={busy || !input} onClick={() => void receive()}>
        Decrypt & save
      </button>
      <p className="muted">
        Requires the separately deployed storage service. Keep the entire link
        private. Revocation cannot erase copies already downloaded. Optional
        download limits and upload recovery are not implemented.
      </p>
    </section>
  );
}
