import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { hashFile } from "./hash";
import { FairScheduler, persistFile, recoverFiles, forgetFile } from "./queue";
import QRCode from "qrcode";
import { ArrowUpRight, Upload, Shield, Zap, Laptop, Moon } from "lucide-react";
import "./style.css";
import { OnlinePanel } from "./online";
import { LaterPanel } from "./later";
import { OpticalPanel } from "./optical";
import { ModeCards } from "./mode-cards";
import { TransferHistory } from "./transfer-history";
type Device = { id: string; name: string; approved: boolean };
type Transfer = {
  id: string;
  name: string;
  size: number;
  sender: string;
  recipient: string;
  state: string;
  chunk_size?: number;
  sha256: string;
  received?: number;
  speed?: number;
  save_outcome?: string;
};
function App() {
  const [preparing, setPreparing] = useState("");
  const [visited, setVisited] = useState<string[]>([]);
  const [token, setToken] = useState(sessionStorage.getItem("token") || ""),
    [me, setMe] = useState<{
      id: string;
      pairing_code?: string;
      connection_url?: string;
    }>(),
    [devices, setDevices] = useState<Device[]>([]),
    [transfers, setTransfers] = useState<Transfer[]>([]),
    [page, setPage] = useState("Home"),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState("My device"),
    [recipient, setRecipient] = useState(""),
    [text, setText] = useState(""),
    [history, setHistory] = useState<Array<{ sender: string; text: string }>>(
      [],
    ),
    [progress, setProgress] = useState<Record<string, number>>({}),
    [qr, setQr] = useState("");
  useEffect(() => {
    setVisited((items) => (items.includes(page) ? items : [...items, page]));
  }, [page]);
  const socket = useRef<WebSocket | null>(null),
    files = useRef(new Map<string, File>()),
    busy = useRef(new Set<string>()),
    failed = useRef(new Set<string>());
  const scheduler = useRef(new FairScheduler(2));
  const activeToken = useRef(token);
  const requests = useRef(new Set<AbortController>());
  useEffect(() => {
    activeToken.current = token;
    return () => {
      for (const request of requests.current) request.abort();
      requests.current.clear();
    };
  }, [token]);
  const scope = useRef("");
  useEffect(() => {
    let active = true;
    files.current.clear();
    busy.current.clear();
    failed.current.clear();
    setTransfers([]);
    setPreparing("");
    setHistory([]);
    setProgress({});
    if (token && me)
      void (async () => {
        const identity = await hashFile(new Blob([token]));
        scope.current = identity;
        const saved = await recoverFiles(identity);
        const authorized = (await api("/transfers")) as Transfer[];
        for (const item of saved) {
          const transfer = authorized.find(
            (t) =>
              t.id === item.id &&
              t.sender === me.id &&
              ["PENDING", "ACCEPTED", "TRANSFERRING", "PAUSED"].includes(
                t.state,
              ),
          );
          if (
            transfer &&
            transfer.sha256 === item.sha256 &&
            item.file.size === transfer.size &&
            (await hashFile(item.file)) === transfer.sha256 &&
            active
          )
            files.current.set(item.id, item.file);
        }
        if (active) await refresh();
      })().catch(report);
    return () => {
      active = false;
    };
  }, [token, me?.id]);
  async function api(path: string, options: RequestInit = {}) {
    if (activeToken.current !== token)
      throw new Error("Session changed; reconnect before retrying");
    const controller = new AbortController();
    requests.current.add(controller);
    let r: Response;
    try {
      r = await fetch("/api" + path, {
        ...options,
        signal: controller.signal,
        headers: { Authorization: "Bearer " + token, ...options.headers },
      });
    } finally {
      requests.current.delete(controller);
    }
    if (activeToken.current !== token)
      throw new Error("Session changed; reconnect before retrying");
    if (!r.ok) {
      const body = await r
        .json()
        .catch(() => ({ detail: "Request failed. Reconnect and retry." }));
      const detail = Array.isArray(body.detail)
        ? body.detail.map((item: { msg: string }) => item.msg).join("; ")
        : body.detail;
      throw Object.assign(new Error(detail || r.statusText), {
        status: r.status,
      });
    }
    const result = r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : r;
    if (activeToken.current !== token)
      throw new Error("Session changed; reconnect before retrying");
    return result;
  }
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
  async function refresh() {
    try {
      setMe(await api("/session"));
      setDevices(await api("/devices"));
      setTransfers(await api("/transfers"));
      setError((e) => (e === "Session expired or unauthorized" ? "" : e));
    } catch (e) {
      if (activeToken.current !== token) return;
      if ((e as { status?: number }).status === 401) setMe(undefined);
      report(e);
    }
  }
  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has("host")) {
      setToken(fragment.get("host")!);
      location.hash = "";
    }
    if (fragment.has("code")) setCode(fragment.get("code")!);
    if (fragment.has("share")) setPage("Send Later");
  }, []);
  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem("token", token);
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [token]);
  useEffect(() => {
    if (!me) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    function connect() {
      const ws = new WebSocket(
        location.origin.replace(/^http/, "ws") + "/api/ws",
      );
      socket.current = ws;
      ws.onopen = () => ws.send(token);
      ws.onclose = () => {
        if (active) timer = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === "text")
          setHistory((h) =>
            [{ sender: d.sender, text: d.text }, ...h].slice(0, 100),
          );
        else void refresh();
      };
    }
    connect();
    return () => {
      active = false;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [me?.id, token]);
  useEffect(() => {
    if (me?.pairing_code)
      void QRCode.toDataURL(
        (me.connection_url || location.origin) + "/#code=" + me.pairing_code,
      ).then(setQr);
  }, [me?.pairing_code, me?.connection_url]);
  useEffect(() => {
    for (const t of transfers) {
      if (
        t.sender === me?.id &&
        ["ACCEPTED", "TRANSFERRING"].includes(t.state) &&
        files.current.has(t.id) &&
        !busy.current.has(t.id) &&
        !failed.current.has(t.id)
      )
        void upload(t);
    }
  }, [transfers]);
  async function upload(t: Transfer) {
    busy.current.add(t.id);
    try {
      const f = files.current.get(t.id)!;
      const checkpoint = await api(`/transfers/${t.id}`);
      const done = new Set<number>(checkpoint.completed_chunks);
      const size = t.chunk_size || 1048576;
      const count = Math.ceil(f.size / size);
      let acknowledged = [...done]
        .filter(
          (index) => Number.isInteger(index) && index >= 0 && index < count,
        )
        .reduce((sum, index) => sum + Math.min(size, f.size - index * size), 0);
      for (let i = 0; i < count; i++) {
        if (!done.has(i)) {
          await scheduler.current.run(t.id, () =>
            api(`/transfers/${t.id}/chunks/${i}`, {
              method: "PUT",
              body: f.slice(i * size, (i + 1) * size),
            }),
          );
          acknowledged += Math.min(size, f.size - i * size);
        }
        setProgress((p) => ({
          ...p,
          [t.id]: f.size ? Math.round((acknowledged / f.size) * 100) : 100,
        }));
      }
      await api(`/transfers/${t.id}/finish`, { method: "POST" });
      files.current.delete(t.id);
      await forgetFile(t.id);
      await refresh();
    } catch (e) {
      failed.current.add(t.id);
      report(e);
    } finally {
      busy.current.delete(t.id);
    }
  }
  async function select(selected: FileList | null) {
    if (!selected) return;
    if (!recipient) {
      setError("Select a recipient first.");
      return;
    }
    try {
      for (const file of Array.from(selected)) {
        setPreparing("Checking SHA-256 before offering " + file.name);
        const digest = await hashFile(file);
        const recipients =
          recipient === "*"
            ? devices
                .filter((d) => d.approved && d.id !== me?.id)
                .map((d) => d.id)
            : [recipient];
        if (!recipients.length)
          throw new Error("No authorized recipients are connected.");
        for (const recipient of recipients) {
          const t = await api("/transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              recipient,
              sha256: digest,
            }),
          });
          files.current.set(t.id, file);
          try {
            const identity = await hashFile(new Blob([token]));
            await persistFile({
              id: t.id,
              scope: identity,
              file,
              sha256: digest,
            });
          } catch {
            setError(
              "Browser storage is unavailable or full. Transfer can continue; reselect the original file after refresh.",
            );
          }
        }
      }
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      setPreparing("");
    }
  }
  async function download(t: Transfer) {
    try {
      await api(`/transfers/${t.id}/download-ticket`, { method: "POST" });
      const anchor = document.createElement("a");
      anchor.href = `/api/transfers/${t.id}/download`;
      anchor.download = t.name;
      anchor.click();
    } catch (e) {
      report(e);
    }
  }
  async function restore(t: Transfer, file?: File) {
    if (!file) return;
    try {
      if (file.size !== t.size || (await hashFile(file)) !== t.sha256)
        throw new Error(
          "Reselect the original file; size and SHA-256 must match.",
        );
      files.current.set(t.id, file);
      failed.current.delete(t.id);
      if (t.state === "PAUSED")
        await api(`/transfers/${t.id}/resume`, { method: "POST" });
      await refresh();
    } catch (e) {
      report(e);
    }
  }
  const nav = [
    "Home",
    "Online Share",
    "Offline LAN",
    "Send Later",
    "Share Text",
    "Connected Devices",
    "Transfer Dashboard",
    "Settings",
    "Optical Text",
  ];
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#">
          <Zap fill="currentColor" /> FlowDrop<span>●</span>
        </a>
        <p className="caption">YOUR SPACE. YOUR FILES.</p>
        <nav>
          {nav.map((x) => (
            <button
              className={page === x ? "active" : ""}
              key={x}
              onClick={() => setPage(x)}
            >
              {x}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </nav>
        <div className="privacy">
          <Shield size={22} />
          <b>Private by design</b>
          <small>No accounts. No file tracking.</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            <i /> LOCAL WORKSPACE
          </span>
          <button
            aria-label="Toggle theme"
            onClick={() => document.body.classList.toggle("dark")}
          >
            <Moon size={18} />
          </button>
        </header>
        <section className="intro">
          <div className="eyebrow">
            A LITTLE LESS FRICTION. A LOT MORE FLOW.
          </div>
          <h1>
            {page === "Home" ? (
              <>
                Your files.
                <br />
                <em>On the move.</em>
              </>
            ) : (
              page
            )}
          </h1>
          <p>
            Share anything. Anywhere. Even offline.
            <br />A simple way to bring your devices together.
          </p>
        </section>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {page === "Home" && <ModeCards onSelect={setPage} />}
        {page === "Transfer Dashboard" && <TransferHistory onMode={setPage} />}
        <div hidden={page !== "Send Later"}>
          {(page === "Send Later" || visited.includes("Send Later")) && (
            <LaterPanel />
          )}
        </div>
        <div hidden={page !== "Online Share"}>
          {(page === "Online Share" || visited.includes("Online Share")) && (
            <OnlinePanel />
          )}
        </div>
        {page === "Send Later" || page === "Online Share" ? null : page ===
          "Optical Text" ? (
          <OpticalPanel />
        ) : !me ? (
          <section className="panel">
            <h2>Connect to this host</h2>
            <p>Enter the code shown on the host, then wait for approval.</p>
            <label>
              Device name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Pairing code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <button
              onClick={async () => {
                try {
                  const r = await fetch("/api/pair", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, code }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.detail);
                  setToken(d.token);
                } catch (e) {
                  report(e);
                }
              }}
            >
              Request connection
            </button>
          </section>
        ) : (
          <>
            {["Home", "Offline LAN", "Transfer Dashboard"].includes(page) && (
              <section className="panel">
                <div className="section-title">
                  <h2>Send something good</h2>
                  <span>LAN TRANSFER</span>
                  {preparing && <p aria-live="polite">{preparing}</p>}
                </div>
                <label>
                  Send to
                  <select
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    <option value="">Choose a connected device</option>
                    <option value="*">All authorized devices</option>
                    {devices
                      .filter((d) => d.approved && d.id !== me.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label
                  className="drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void select(e.dataTransfer.files);
                  }}
                >
                  <Upload />
                  <b>Drop files here, or browse</b>
                  <span>Any file type • Receiver approval required</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => void select(e.target.files)}
                  />
                </label>
                <p className="muted">
                  The host must stay running. All devices need the same local
                  network. HTTP LAN traffic is not encrypted.
                </p>
                {"webkitdirectory" in document.createElement("input") && (
                  <label>
                    Choose folder contents (files are saved separately)
                    <input
                      type="file"
                      multiple
                      {...{ webkitdirectory: "" }}
                      onChange={(e) => void select(e.target.files)}
                    />
                  </label>
                )}
                <h2>Transfers</h2>
                {transfers.length === 0 ? (
                  <p className="muted">
                    Nothing in the queue yet. Your next transfer starts here.
                  </p>
                ) : (
                  transfers.map((t) => (
                    <article className="transfer" key={t.id}>
                      <div>
                        <b>{t.name}</b>
                        <small>
                          {(t.size / 1048576).toFixed(2)} MB · {t.state}{" "}
                          {t.state === "COMPLETED" ? "· SHA-256 verified" : ""}
                        </small>
                        <progress
                          max={100}
                          value={
                            t.state === "COMPLETED"
                              ? 100
                              : Math.max(
                                  progress[t.id] || 0,
                                  t.size
                                    ? ((t.received || 0) / t.size) * 100
                                    : 0,
                                )
                          }
                        />
                        <small>
                          {t.state === "COMPLETED"
                            ? "100%"
                            : `${Math.round(t.size ? ((t.received || 0) / t.size) * 100 : 0)}%`}{" "}
                          ·{" "}
                          {t.sender === me.id
                            ? `You → ${devices.find((d) => d.id === t.recipient)?.name || "Recipient"}`
                            : `${devices.find((d) => d.id === t.sender)?.name || "Sender"} → you`}{" "}
                          · LAN
                        </small>
                        {t.state === "TRANSFERRING" && !!t.speed && (
                          <small>
                            Host upload {(t.speed / 1048576).toFixed(1)} MiB/s ·
                            about{" "}
                            {Math.ceil((t.size - (t.received || 0)) / t.speed)}{" "}
                            seconds remaining
                          </small>
                        )}
                      </div>
                      {t.state === "PENDING" && t.recipient === me.id && (
                        <button
                          onClick={() =>
                            api(`/transfers/${t.id}/accept`, { method: "POST" })
                              .then(refresh)
                              .catch(report)
                          }
                        >
                          Accept
                        </button>
                      )}
                      {t.state === "COMPLETED" && t.recipient === me.id && (
                        <>
                          <button onClick={() => void download(t)}>
                            Save file
                          </button>
                          <small>
                            {t.save_outcome
                              ? `Receiver reported: ${t.save_outcome}`
                              : "Verified on host; browser save not confirmed"}
                          </small>
                          <button
                            onClick={() =>
                              void api(`/transfers/${t.id}/save-outcome`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ outcome: "saved" }),
                              })
                                .then(refresh)
                                .catch(report)
                            }
                          >
                            I checked the saved file
                          </button>
                        </>
                      )}
                      {["ACCEPTED", "TRANSFERRING"].includes(t.state) && (
                        <button
                          onClick={() =>
                            api(`/transfers/${t.id}/pause`, { method: "POST" })
                              .then(refresh)
                              .catch(report)
                          }
                        >
                          Pause
                        </button>
                      )}
                      {t.state === "PAUSED" && (
                        <button
                          onClick={() => {
                            failed.current.delete(t.id);
                            void api(`/transfers/${t.id}/resume`, {
                              method: "POST",
                            })
                              .then(refresh)
                              .catch(report);
                          }}
                        >
                          Resume
                        </button>
                      )}
                      {t.sender === me.id &&
                        ["ACCEPTED", "TRANSFERRING", "PAUSED"].includes(
                          t.state,
                        ) && (
                          <>
                            <label>
                              Reselect original file / retry
                              <input
                                type="file"
                                onChange={(e) =>
                                  void restore(t, e.target.files?.[0])
                                }
                              />
                            </label>
                            {failed.current.has(t.id) &&
                              files.current.has(t.id) && (
                                <button
                                  onClick={() =>
                                    void restore(t, files.current.get(t.id))
                                  }
                                >
                                  Retry queued file
                                </button>
                              )}
                          </>
                        )}
                      {t.state !== "CANCELLED" && (
                        <button
                          onClick={() =>
                            api(`/transfers/${t.id}`, { method: "DELETE" })
                              .then(refresh)
                              .catch(report)
                          }
                        >
                          Cancel / delete
                        </button>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}
            {["Offline LAN", "Connected Devices"].includes(page) && (
              <section className="panel">
                <h2>Your connected devices</h2>
                {me.pairing_code && (
                  <div className="pairing">
                    <img src={qr} alt="Scan to connect to this LAN host" />
                    <div>
                      <p>
                        Connection URL: {me.connection_url || location.origin}
                      </p>
                      <p>Pairing code</p>
                      <h2>{me.pairing_code}</h2>
                      <small>Expires 10 minutes after host launch.</small>
                      <button
                        onClick={() =>
                          api("/pair/renew", { method: "POST" })
                            .then(refresh)
                            .catch(report)
                        }
                      >
                        Renew pairing code
                      </button>
                    </div>
                  </div>
                )}
                {devices.map((d) => (
                  <article className="transfer" key={d.id}>
                    <Laptop />
                    <b>{d.name}</b>
                    <span>
                      {d.approved ? "Authorized" : "Waiting for approval"}
                    </span>
                    {me.id === "host" && d.id !== "host" && (
                      <button
                        onClick={() =>
                          api(
                            "/devices/" + d.id + (d.approved ? "" : "/approve"),
                            { method: d.approved ? "DELETE" : "POST" },
                          )
                            .then(refresh)
                            .catch(report)
                        }
                      >
                        {d.approved ? "Revoke" : "Approve"}
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
            {page === "Share Text" && (
              <section className="panel">
                <h2>Words travel too.</h2>
                <select
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                >
                  <option value="">Choose recipient</option>
                  <option value="*">All authorized devices</option>
                  {devices
                    .filter((d) => d.id !== me.id && d.approved)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
                <textarea
                  maxLength={65536}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Text, a link, or a code snippet"
                />
                <button
                  onClick={() => {
                    if (
                      !recipient ||
                      socket.current?.readyState !== WebSocket.OPEN
                    ) {
                      setError("Choose a connected recipient.");
                      return;
                    }
                    const recipients =
                      recipient === "*"
                        ? devices
                            .filter((d) => d.approved && d.id !== me.id)
                            .map((d) => d.id)
                        : [recipient];
                    for (const recipient of recipients)
                      socket.current.send(
                        JSON.stringify({ type: "text", text, recipient }),
                      );
                    setHistory((h) =>
                      [{ sender: "You", text }, ...h].slice(0, 100),
                    );
                    setText("");
                  }}
                >
                  Send text
                </button>
                <button onClick={() => setHistory([])}>Clear history</button>
                {history.map((h, i) => (
                  <div key={i}>
                    <small>{h.sender}</small>
                    <pre>{h.text}</pre>
                    <button
                      onClick={() => {
                        if (navigator.clipboard && window.isSecureContext)
                          void navigator.clipboard
                            .writeText(h.text)
                            .catch(() =>
                              setError(
                                "Clipboard permission denied. Select the text and copy manually.",
                              ),
                            );
                        else
                          setError(
                            "Select the received text and copy manually; clipboard APIs require a secure context.",
                          );
                      }}
                    >
                      Copy text
                    </button>
                    <button onClick={() => setText(h.text)}>Resend</button>
                  </div>
                ))}
              </section>
            )}
            {page === "Settings" && (
              <section className="panel">
                <h2>Session settings</h2>
                <p>
                  Session credentials stay in this browser tab. Reopening the
                  browser requires pairing again.
                </p>
                <button
                  onClick={() => {
                    sessionStorage.clear();
                    setToken("");
                    setMe(undefined);
                  }}
                >
                  Disconnect this browser
                </button>
              </section>
            )}
          </>
        )}
        <footer>
          <Shield size={14} /> Your files belong to you.
          <span>FLOWDROP / 0.3.0 DEVELOPMENT</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
