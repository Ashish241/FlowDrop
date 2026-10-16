import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { OnlinePanel, type RoomTransferHandle } from "./online";
type Member = {
  id: string;
  name: string;
  online: boolean;
  kind?: "computer" | "phone" | "tablet";
};
type Snapshot = {
  members: Member[];
  owner: string;
  code: string;
  locked: boolean;
  expires: number;
  code_expires: number;
};
type Session = Snapshot & { room: string; token: string; member: string };
type Peer = {
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  candidates: RTCIceCandidateInit[];
  state: string;
};
const base =
  ((import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SIGNAL_URL || "/signal") + "/v2";
const sessionKey = "flowdrop-room-v2";
function validName(name: string) {
  return (
    name.trim().length > 0 &&
    name.trim().length <= 32 &&
    !Array.from(name).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  );
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(70000),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw new Error(
      value.detail || `Connection unavailable (${response.status})`,
    );
  }
  return response.json();
}
export function RoomDashboard({
  action,
}: {
  action: "Create Room" | "Join Room";
}) {
  const [name, setName] = useState(
    () => localStorage.getItem("flowdrop-device-name") || "",
  );
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem("flowdrop-device-name"),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("room") || "",
  );
  const [session, setSession] = useState<Session>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [status, setStatus] = useState("Waiting");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [departed, setDeparted] = useState<
    Array<{ id: string; name: string; state: string }>
  >([]);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState(false);
  const [qr, setQr] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [revision, refresh] = useState(0);
  const peers = useRef(new Map<string, Peer>());
  const handles = useRef(new Map<string, RoomTransferHandle>());
  const ws = useRef<WebSocket | undefined>(undefined);
  const retry = useRef<(() => void) | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const retryDevice = useRef<((id: string) => void) | undefined>(undefined);
  const invitation = snapshot
    ? `${location.origin}/#room=${snapshot.code}`
    : "";
  useEffect(() => {
    if (invitation) void QRCode.toDataURL(invitation).then(setQr);
  }, [invitation]);
  useEffect(() => {
    try {
      const cached = JSON.parse(
        sessionStorage.getItem(sessionKey) || "null",
      ) as Session | null;
      if (cached && cached.expires * 1000 > Date.now()) {
        setSession(cached);
        setSnapshot(cached);
        setConfirmed(true);
        setName(cached.members.find((m) => m.id === cached.member)?.name || "");
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    let ice: RTCConfiguration = {};
    let members: Member[] = [];
    const identity = session;
    function send(data: unknown) {
      if (ws.current?.readyState === WebSocket.OPEN)
        ws.current.send(JSON.stringify(data));
    }
    function destroy(id: string) {
      const p = peers.current.get(id);
      peers.current.delete(id);
      p?.pc.close();
      handles.current.delete(id);
      refresh((n) => n + 1);
    }
    function peer(id: string) {
      const existing = peers.current.get(id);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ice),
        p: Peer = { pc, candidates: [], state: "Connecting" };
      peers.current.set(id, p);
      pc.onicecandidate = (e) => {
        if (e.candidate)
          send({ type: "ice", to: id, candidate: e.candidate.toJSON() });
      };
      function channel(dc: RTCDataChannel) {
        p.channel = dc;
        dc.addEventListener("open", () => {
          p.state = "Connected";
          refresh((n) => n + 1);
        });
        dc.addEventListener("close", () => {
          p.state = "Reconnecting";
          refresh((n) => n + 1);
        });
        refresh((n) => n + 1);
      }
      pc.ondatachannel = (e) => channel(e.channel);
      pc.onconnectionstatechange = () => {
        p.state =
          pc.connectionState === "connected"
            ? "Connected"
            : pc.connectionState === "failed"
              ? "Connection failed"
              : pc.connectionState === "disconnected"
                ? "Reconnecting"
                : "Connecting";
        refresh((n) => n + 1);
        if (pc.connectionState === "failed") {
          destroy(id);
          send({ type: "retry", to: id });
          void offer(id);
        }
      };
      if (identity.member < id) channel(pc.createDataChannel("flowdrop"));
      return p;
    }
    async function offer(id: string) {
      const p = peer(id);
      if (identity.member < id) {
        await p.pc.setLocalDescription(await p.pc.createOffer());
        send({ type: "offer", to: id, sdp: p.pc.localDescription!.sdp });
      }
    }
    retryDevice.current = (id) => {
      destroy(id);
      send({ type: "retry", to: id });
      void offer(id);
    };
    async function connect() {
      if (disposed) return;
      setStatus(reconnectAttempts.current ? "Reconnecting" : "Connecting");
      try {
        ice = await request(
          `/rooms/${identity.room}/ice`,
          "GET",
          undefined,
          identity.token,
        );
        if (disposed) return;
        const socket = new WebSocket(
          new URL(base, location.href).href.replace(/^http/, "ws") +
            `/rooms/${identity.room}/ws`,
        );
        ws.current = socket;
        socket.onopen = () => socket.send(identity.token);
        let chain = Promise.resolve();
        socket.onmessage = (e) => {
          chain = chain
            .then(async () => {
              if (disposed || ws.current !== socket) return;
              const event = JSON.parse(e.data);
              if (event.type === "members") {
                reconnectAttempts.current = 0;
                setStatus("Connected");
                setError("");
                setSnapshot(event);
                sessionStorage.setItem(
                  sessionKey,
                  JSON.stringify({ ...identity, ...event }),
                );
                for (const [id] of peers.current)
                  if (
                    !event.members.some((m: Member) => m.id === id && m.online)
                  )
                    destroy(id);
                for (const m of event.members as Member[])
                  if (
                    m.id !== identity.member &&
                    m.online &&
                    !peers.current.has(m.id)
                  )
                    await offer(m.id);
                const gone = members.filter(
                  (m) =>
                    m.id !== identity.member &&
                    m.online &&
                    !event.members.some(
                      (next: Member) => next.id === m.id && next.online,
                    ),
                );
                setDeparted((previous) =>
                  [
                    ...gone.map((m) => ({
                      id: m.id,
                      name: m.name,
                      state: event.members.some(
                        (next: Member) => next.id === m.id,
                      )
                        ? "Disconnected · interrupted files need retry"
                        : "Left room · transfer stopped",
                    })),
                    ...previous,
                  ]
                    .filter(
                      (m, i, all) =>
                        all.findIndex((n) => n.id === m.id) === i &&
                        !event.members.some(
                          (next: Member) => next.id === m.id && next.online,
                        ),
                    )
                    .slice(0, 8),
                );
                members = event.members;
                setSelected((ids) =>
                  ids.filter((id) =>
                    members.some((m) => m.id === id && m.online),
                  ),
                );
              } else if (event.type === "error") setError(event.message);
              else if (
                ["offer", "answer", "ice", "retry"].includes(event.type) &&
                members.some((m) => m.id === event.from && m.online)
              ) {
                if (event.type === "retry") {
                  destroy(event.from);
                  await offer(event.from);
                  return;
                }
                const p = peer(event.from);
                if (event.type === "offer") {
                  if (identity.member < event.from) return;
                  await p.pc.setRemoteDescription({
                    type: "offer",
                    sdp: event.sdp,
                  });
                  for (const candidate of p.candidates.splice(0))
                    await p.pc.addIceCandidate(candidate);
                  await p.pc.setLocalDescription(await p.pc.createAnswer());
                  send({
                    type: "answer",
                    to: event.from,
                    sdp: p.pc.localDescription!.sdp,
                  });
                } else if (event.type === "answer") {
                  await p.pc.setRemoteDescription({
                    type: "answer",
                    sdp: event.sdp,
                  });
                  for (const candidate of p.candidates.splice(0))
                    await p.pc.addIceCandidate(candidate);
                } else if (p.pc.remoteDescription)
                  await p.pc.addIceCandidate(event.candidate);
                else p.candidates.push(event.candidate);
              }
            })
            .catch(() => {
              setError("Connection interrupted. Retry the affected device.");
            });
        };
        socket.onclose = (e) => {
          if (disposed || ws.current !== socket) return;
          if (e.code === 4001 || e.code === 4002) {
            setStatus("Connection failed");
            setError(
              e.code === 4002
                ? "This session opened in another tab."
                : "Room expired or ended. Start or join a new room.",
            );
            sessionStorage.removeItem(sessionKey);
            for (const [id] of peers.current) destroy(id);
            setSession(undefined);
            setSnapshot(undefined);
            setSelected([]);
            setFiles([]);
            setMessage("");
            return;
          }
          setStatus("Reconnecting");
          for (const [id] of peers.current) destroy(id);
          if (reconnectAttempts.current++ < 5)
            timer = setTimeout(
              () => void connect(),
              Math.min(1000 * 2 ** reconnectAttempts.current, 15000),
            );
          else {
            setStatus("Connection failed");
            setError("Could not reconnect. Your selected files are retained.");
          }
        };
      } catch (reason) {
        if (!disposed) {
          setError(String(reason));
          setStatus("Connection failed");
        }
      }
    }
    retry.current = () => {
      clearTimeout(timer);
      reconnectAttempts.current = 0;
      const old = ws.current;
      ws.current = undefined;
      old?.close();
      void connect();
    };
    void connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws.current?.close();
      for (const p of peers.current.values()) p.pc.close();
      peers.current.clear();
      handles.current.clear();
    };
  }, [session]);
  async function enter() {
    if (!validName(name)) {
      setError("Enter a device name of 1–32 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (remember) localStorage.setItem("flowdrop-device-name", name.trim());
      else localStorage.removeItem("flowdrop-device-name");
      const value = await request(
        action === "Create Room" ? "/rooms" : `/rooms/${code}/join`,
        "POST",
        {
          name: name.trim(),
          kind: /iPad|Tablet/i.test(navigator.userAgent)
            ? "tablet"
            : /Mobile|Android/i.test(navigator.userAgent)
              ? "phone"
              : "computer",
        },
      );
      setSession(value);
      setSnapshot(value);
      setConfirmed(true);
      sessionStorage.setItem(sessionKey, JSON.stringify(value));
      history.replaceState(null, "", location.pathname);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (!session) return;
    setBusy(true);
    try {
      await request(
        `/rooms/${session.room}/membership`,
        "DELETE",
        undefined,
        session.token,
      );
      sessionStorage.removeItem(sessionKey);
      setSession(undefined);
      setSnapshot(undefined);
      setSelected([]);
      setFiles([]);
      setMessage("");
      setDeparted([]);
      setStatus("Waiting");
      setError("");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  const eligible =
    snapshot?.members.filter((m) => m.id !== session?.member && m.online) || [];
  const displayName = (m: Member) => {
    const same = snapshot?.members.filter((peer) => peer.name === m.name) || [];
    return same.length > 1
      ? `${m.name} (${same.findIndex((peer) => peer.id === m.id) + 1})`
      : m.name;
  };
  const ready = (id: string) =>
    peers.current.get(id)?.channel?.readyState === "open";
  const selectedReady = selected.filter(
    (id) => eligible.some((m) => m.id === id) && ready(id),
  );
  function sendEvent(data: unknown) {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify(data));
    else setError("Reconnecting. Retry when connected.");
  }
  return (
    <section
      className="panel room-dashboard"
      aria-label="Room dashboard"
      data-revision={revision}
    >
      {error && <p role="alert">{error}</p>}
      {!session ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (action === "Join Room" && !confirmed && !code) {
              setConfirmed(true);
              return;
            }
            void enter();
          }}
        >
          <h2>
            {confirmed && action === "Join Room"
              ? "Enter room code"
              : "What should we call this device?"}
          </h2>
          <label>
            Device name
            <input
              autoComplete="nickname"
              maxLength={32}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember this name on this browser
          </label>
          <p>
            Your display name is shared only with room members. No login needed.
          </p>
          {action === "Join Room" && (confirmed || code) && (
            <label>
              Room code
              <input
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            </label>
          )}
          <button className="primary" disabled={busy || !validName(name)}>
            {busy
              ? "Connecting…"
              : action === "Join Room" && !confirmed && !code
                ? "Continue"
                : action}
          </button>
        </form>
      ) : (
        <>
          <div className="room-heading">
            <div>
              <h2>
                Room <small>{snapshot?.code}</small>
              </h2>
              <p role="status">
                {status === "Connected"
                  ? eligible.length === 0
                    ? "Waiting for devices"
                    : eligible.every((m) => ready(m.id))
                      ? "Connected"
                      : "Connecting"
                  : status}
              </p>
            </div>
            <button onClick={() => setInvite(!invite)}>Invite Device</button>
          </div>
          {status === "Connection failed" && (
            <button onClick={() => retry.current?.()}>Retry</button>
          )}
          {invite || eligible.length === 0 ? (
            <section aria-label="Room invitation">
              <p>
                Anyone with this temporary code can join. Only accept files from
                people you trust.
              </p>
              <strong className="code" data-testid="room-code">
                {snapshot?.code}
              </strong>
              <p>Invitation valid for 10 minutes from creation.</p>
              {qr && (
                <img className="room-qr" src={qr} alt="Scan room invitation" />
              )}
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(snapshot?.code || "")
                    .then(() => setError("Code copied"))
                    .catch(() =>
                      setError("Copy unavailable. Select the code to copy."),
                    )
                }
              >
                Copy Code
              </button>
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invitation)
                    .then(() => setError("Link copied"))
                    .catch(() =>
                      setError("Copy unavailable. Select the code to copy."),
                    )
                }
              >
                Copy Link
              </button>
            </section>
          ) : null}
          <h3>Connected Devices</h3>
          <ul className="room-members" aria-label="Connected Devices">
            {snapshot?.members.map((m) => (
              <li key={m.id}>
                <span aria-hidden="true">
                  {m.kind === "phone"
                    ? "▯"
                    : m.kind === "tablet"
                      ? "▭"
                      : "▣"}{" "}
                </span>
                <span>
                  {displayName(m)}
                  {m.id === session.member ? " (you)" : ""}
                </span>
                <small>
                  {m.id === session.member
                    ? status
                    : !m.online
                      ? "Reconnecting"
                      : peers.current.get(m.id)?.state || "Connecting"}
                </small>
                {m.id === session.member ? (
                  <button
                    aria-label="Edit device name"
                    onClick={() => {
                      setName(m.name);
                      setRenaming(!renaming);
                    }}
                  >
                    ✎
                  </button>
                ) : m.online ? (
                  <label className="check-label">
                    <input
                      aria-label={`Select ${displayName(m)}`}
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, m.id]
                            : ids.filter((id) => id !== m.id),
                        )
                      }
                    />
                    Select
                  </label>
                ) : null}
                {m.id !== session.member && m.online && !ready(m.id) && (
                  <button
                    onClick={() => {
                      const p = peers.current.get(m.id);
                      peers.current.delete(m.id);
                      p?.pc.close();
                      sendEvent({ type: "retry", to: m.id });
                      refresh((n) => n + 1);
                    }}
                  >
                    Retry device
                  </button>
                )}
              </li>
            ))}
          </ul>
          {renaming && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (validName(name)) {
                  sendEvent({ type: "rename", name: name.trim() });
                  if (remember)
                    localStorage.setItem("flowdrop-device-name", name.trim());
                  setRenaming(false);
                }
              }}
            >
              <label>
                New device name
                <input
                  value={name}
                  required
                  maxLength={32}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button disabled={!validName(name)}>Save name</button>
            </form>
          )}
          <div className="room-actions">
            <button onClick={() => setSelected(eligible.map((m) => m.id))}>
              Select All
            </button>
            <button onClick={() => setSelected([])}>Clear Selection</button>
            <span>{selected.length} selected</span>
          </div>
          <section aria-label="Send Files">
            <h3>Send Files</h3>
            <label className="file-picker">
              Choose files
              <input
                aria-label="Choose files"
                type="file"
                multiple
                onChange={(e) => {
                  const incomingFiles = Array.from(e.target.files || []);
                  if (incomingFiles.length > 128) {
                    setError("Choose up to 128 files per batch.");
                    return;
                  }
                  setFiles(incomingFiles);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length ? (
              <ul>
                {files.map((f, i) => (
                  <li key={i}>
                    {f.name} · {f.size.toLocaleString()} bytes
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select files, then choose who receives them.</p>
            )}
            <button
              className="primary"
              disabled={
                !files.length ||
                !selectedReady.length ||
                selectedReady.length !== selected.length
              }
              onClick={() => {
                const batch = [...files],
                  recipients = [...selectedReady];
                for (const id of recipients)
                  void handles.current.get(id)?.sendFiles(batch);
              }}
            >
              Send to Selected Devices
            </button>
            <p>
              Each recipient accepts independently. Each file is verified before
              completion.
            </p>
          </section>
          <details className="text-share">
            <summary>Share Text</summary>
            <label>
              Message
              <textarea
                maxLength={65536}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <button
              disabled={!message.trim() || !selectedReady.length}
              onClick={() => {
                for (const id of [...selectedReady])
                  handles.current.get(id)?.sendText(message);
                setMessage("");
              }}
            >
              Send text to Selected Devices
            </button>
          </details>
          <h3>Transfers</h3>
          {departed.length > 0 && (
            <ul aria-label="Disconnected recipients">
              {departed.map((m) => (
                <li key={m.id}>
                  {m.name} — {m.state}
                </li>
              ))}
            </ul>
          )}
          {!eligible.length && (
            <p>Transfers appear here when another device connects.</p>
          )}
          {snapshot?.members
            .filter((m) => m.id !== session.member)
            .map((m) => {
              const p = peers.current.get(m.id);
              return p?.channel ? (
                <details className="recipient-transfer" open key={m.id}>
                  <summary>
                    {displayName(m)} — {p.state}
                  </summary>
                  <button
                    disabled={!files.length || !ready(m.id)}
                    onClick={() =>
                      void handles.current.get(m.id)?.sendFiles([...files])
                    }
                  >
                    Retry files to this device
                  </button>
                  <OnlinePanel
                    consumer
                    mode="Room transfer"
                    roomLink={{
                      channel: p.channel,
                      room: session.room,
                      token: session.token,
                      member: session.member,
                      remoteName: displayName(m),
                      register: (handle) => {
                        if (handle) handles.current.set(m.id, handle);
                        else handles.current.delete(m.id);
                      },
                    }}
                  />
                </details>
              ) : null;
            })}
          <div className="room-actions">
            {snapshot?.owner === session.member && (
              <button
                onClick={() =>
                  sendEvent({ type: "lock", locked: !snapshot.locked })
                }
              >
                {snapshot.locked ? "Unlock Room" : "Lock Room"}
              </button>
            )}
            <button disabled={busy} onClick={() => void leave()}>
              {snapshot?.owner === session.member ? "End Room" : "Leave Room"}
            </button>
          </div>
          <details>
            <summary>Settings</summary>
            <details>
              <summary>Advanced Diagnostics</summary>
              <p>
                Signaling: {status}. Direct encrypted peer connections; up to 8
                members, one send per recipient at a time. Membership does not
                imply a file channel is ready.
              </p>
              {[...peers.current].map(([id, p]) => (
                <p key={id}>
                  {snapshot?.members.find((m) => m.id === id)?.name}:{" "}
                  {p.pc.connectionState} /{" "}
                  {p.channel?.readyState || "connecting"}
                </p>
              ))}
            </details>
          </details>
        </>
      )}
    </section>
  );
}
