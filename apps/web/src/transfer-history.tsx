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
};
const key = "flowdrop.transfer-history.v2";
function read(): HistoryEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "[]").slice(-100);
  } catch {
    return [];
  }
}
export function recordTransfer(entry: Omit<HistoryEntry, "updated">) {
  const items = read().filter((item) => item.id !== entry.id);
  sessionStorage.setItem(
    key,
    JSON.stringify([...items, { ...entry, updated: Date.now() }].slice(-100)),
  );
  window.dispatchEvent(new Event("flowdrop-history"));
}
export function TransferHistory({
  onMode,
}: {
  onMode: (page: string) => void;
}) {
  const [items, setItems] = useState(read);
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
      {items.length === 0 && <p>No online transfers in this tab yet.</p>}
      {[...items].reverse().map((item) => (
        <article className="transfer" key={item.id}>
          <b>{item.name}</b>
          <span>
            {item.mode} · {item.direction} · {item.size.toLocaleString()} bytes
          </span>
          <span>{item.state}</span>
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
