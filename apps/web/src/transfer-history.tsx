import { useEffect, useState } from "react";

export type HistoryEntry = {
  id: string;
  mode: "WebRTC" | "Send Later";
  direction: "Send" | "Receive";
  name: string;
  size: number;
  state: string;
  progress: number;
  updated: number;
  sender?: string;
  receiver?: string;
  speed?: number;
  bytes?: number;
  saveOutcome?: string;
  scope?: string;
};
const boot = Date.now();
const key = "flowdrop.transfer-history.v2";
function read(): HistoryEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "[]")
      .slice(-100)
      .map((item: HistoryEntry) =>
        item.updated < boot &&
        /Uploading|Transferring|Waiting for receiver|Sent;/.test(item.state)
          ? {
              ...item,
              state: "Interrupted by refresh; open controls to recover",
              speed: 0,
            }
          : item,
      );
  } catch {
    return [];
  }
}
export function recordTransfer(entry: Omit<HistoryEntry, "updated">) {
  const previous = read().find((item) => item.id === entry.id);
  const bytes = Math.min(
    entry.size,
    Math.max(0, Math.floor((entry.size * entry.progress) / 100)),
  );
  const elapsed = previous ? (Date.now() - previous.updated) / 1000 : 0;
  const measured =
    elapsed > 0.1 && previous
      ? Math.max(0, bytes - (previous.bytes || 0)) / elapsed
      : previous?.speed || 0;
  const items = read().filter((item) => item.id !== entry.id);
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(
        [
          ...items,
          {
            ...previous,
            ...entry,
            bytes,
            speed: measured,
            updated: Date.now(),
          },
        ].slice(-100),
      ),
    );
  } catch {
    /* History persistence failure must not terminate an active transfer. */
  }
  window.dispatchEvent(new Event("flowdrop-history"));
}
export function TransferHistory({
  onMode,
}: {
  onMode: (page: string) => void;
}) {
  const [items, setItems] = useState(read);
  let onlineScope = "";
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("flowdrop.online.v2") || "null",
    );
    if (saved) onlineScope = saved.member + ":" + saved.room;
  } catch {
    /* Invalid session cannot reveal prior history. */
  }
  const visible = items.filter(
    (item) => item.mode !== "WebRTC" || item.scope === onlineScope,
  );
  useEffect(() => {
    const update = () => setItems(read());
    window.addEventListener("flowdrop-history", update);
    return () => window.removeEventListener("flowdrop-history", update);
  }, []);
  return (
    <section className="panel">
      <h2>Online and encrypted transfer history</h2>
      <p>
        History belongs to this browser tab. After refresh, interrupted peer
        transfers must be resent. Browser downloads require checking the
        browser’s save result.
      </p>
      {visible.length === 0 && <p>No online transfers in this tab yet.</p>}
      {[...visible].reverse().map((item) => (
        <article className="transfer" key={item.id}>
          <b>{item.name}</b>
          <span>
            {item.mode} · {item.direction} · {item.size.toLocaleString()} bytes
          </span>
          <span>{item.state}</span>
          <span>
            {item.sender ||
              (item.direction === "Send" ? "This browser" : "Peer")}{" "}
            →{" "}
            {item.receiver ||
              (item.direction === "Receive" ? "This browser" : "Recipient")}
          </span>
          <small>
            {(item.bytes || 0).toLocaleString()} / {item.size.toLocaleString()}{" "}
            bytes · {item.progress.toFixed(1)}%
            {item.progress < 100 &&
              !!item.speed &&
              ` · ${(item.speed / 1048576).toFixed(2)} MiB/s · approximately ${Math.ceil((item.size - (item.bytes || 0)) / item.speed)}s remaining`}
          </small>
          {item.direction === "Receive" && item.progress === 100 && (
            <>
              <small>
                Save outcome:{" "}
                {item.saveOutcome || "Browser save result not yet confirmed"}
              </small>
              <button
                onClick={() =>
                  recordTransfer({
                    ...item,
                    saveOutcome: "Receiver confirmed saved file",
                  })
                }
              >
                I checked the saved file
              </button>
            </>
          )}
          <progress max={100} value={item.progress} />
          <button
            onClick={() =>
              onMode(item.mode === "WebRTC" ? "Online Share" : "Send Later")
            }
          >
            Open transfer controls
          </button>
        </article>
      ))}
      <button
        onClick={() => {
          sessionStorage.removeItem(key);
          setItems([]);
        }}
      >
        Clear online history
      </button>
    </section>
  );
}
