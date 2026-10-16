import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  File,
  Paperclip,
  Send,
  FolderPlus,
  X,
  Monitor,
  Smartphone,
  Tablet,
  Copy,
  ChevronDown,
  ChevronUp,
  Pencil,
  Lock,
  Unlock,
} from "lucide-react";
import { formatSize, mergeAttachments } from "./room-utils";
import { InvitationScanner } from "./invitation-scanner";
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
  onSessionChange,
  onHome,
}: {
  action: "Create Room" | "Join Room";
  onSessionChange?: (active: boolean) => void;
  onHome?: () => void;
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
  const [ended, setEnded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [departed, setDeparted] = useState<
    Array<{ id: string; name: string; state: string }>
  >([]);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState(false);
  const [notice, setNotice] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ from: string; text: string }>
  >([]);
  const picker = useRef<HTMLInputElement>(null),
    folderPicker = useRef<HTMLInputElement>(null);
  const entering = useRef(false);
  const sessionCallback = useRef(onSessionChange);
  sessionCallback.current = onSessionChange;
  const lastHeartbeat = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    sessionCallback.current?.(!!session);
  }, [session]);
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
      if (cached && cached.expires * 1000 <= Date.now()) {
        sessionStorage.removeItem(sessionKey);
        setError(
          "This room session expired. Create or join a room to continue.",
        );
      }
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
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let ice: RTCConfiguration = {};
    let members: Member[] = [];
    let resync = false;
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
      if (
        existing &&
        existing.pc.connectionState !== "closed" &&
        existing.pc.connectionState !== "failed" &&
        existing.channel?.readyState !== "closed"
      )
        return existing;
      if (existing) destroy(id);
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
          if (disposed || peers.current.get(id) !== p) return;
          p.state = "Reconnecting";
          refresh((n) => n + 1);
          setTimeout(() => {
            if (
              !disposed &&
              peers.current.get(id) === p &&
              ws.current?.readyState === WebSocket.OPEN &&
              members.some((m) => m.id === id && m.online)
            )
              retryDevice.current?.(id);
          }, 1000);
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
        socket.onopen = () => {
          socket.send(identity.token);
          lastHeartbeat.current = Date.now();
          clearInterval(heartbeat);
          let lastTick = Date.now();
          heartbeat = setInterval(() => {
            const stamp = Date.now();
            if (stamp - lastTick > 60000) lastHeartbeat.current = stamp;
            lastTick = stamp;
            if (socket.readyState === WebSocket.OPEN) {
              if (
                document.visibilityState === "visible" &&
                Date.now() - lastHeartbeat.current > 95000
              ) {
                socket.close();
                return;
              }
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };
        let chain = Promise.resolve();
        socket.onmessage = (e) => {
          chain = chain
            .then(async () => {
              if (disposed || ws.current !== socket) return;
              const event = JSON.parse(e.data);
              lastHeartbeat.current = Date.now();
              if (event.type === "pong") return;
              if (event.type === "members") {
                const recovering = resync;
                resync = false;
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
                    !event.members.some(
                      (m: Member) =>
                        m.id === id &&
                        (m.online ||
                          peers.current.get(id)?.channel?.readyState ===
                            "open"),
                    )
                  )
                    destroy(id);
                if (recovering)
                  for (const [id, p] of peers.current)
                    if (p.channel?.readyState !== "open") destroy(id);
                for (const m of event.members as Member[])
                  if (
                    m.id !== identity.member &&
                    m.online &&
                    (!peers.current.has(m.id) ||
                      peers.current.get(m.id)?.pc.connectionState ===
                        "closed" ||
                      peers.current.get(m.id)?.pc.connectionState ===
                        "failed" ||
                      peers.current.get(m.id)?.channel?.readyState === "closed")
                  )
                    await offer(m.id);
                const gone = members.filter(
                  (m) =>
                    m.id !== identity.member &&
                    m.online &&
                    peers.current.get(m.id)?.channel?.readyState !== "open" &&
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
                  ids.filter((id) => members.some((m) => m.id === id)),
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
          clearInterval(heartbeat);
          if (e.code === 4001 || e.code === 4002) {
            setStatus("Connection failed");
            setError(
              e.code === 4002
                ? "This session opened in another tab."
                : "Room expired or ended. Start or join a new room.",
            );
            setEnded(true);
            sessionStorage.removeItem(sessionKey);
            for (const [id] of peers.current) destroy(id);
            return;
          }
          resync = true;
          setStatus("Reconnecting…");
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
          if (reconnectAttempts.current++ < 5)
            timer = setTimeout(
              () => void connect(),
              Math.min(1000 * 2 ** reconnectAttempts.current, 15000),
            );
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
      clearInterval(heartbeat);
      ws.current?.close();
      for (const p of peers.current.values()) p.pc.close();
      peers.current.clear();
      handles.current.clear();
    };
  }, [session]);
  async function enter(joinCode = code) {
    if (entering.current || session) return;
    if (!validName(name)) {
      setError("Enter a device name of 1–32 characters.");
      return;
    }
    entering.current = true;
    setBusy(true);
    setError("");
    try {
      if (remember) localStorage.setItem("flowdrop-device-name", name.trim());
      else localStorage.removeItem("flowdrop-device-name");
      const value = await request(
        action === "Create Room" ? "/rooms" : `/rooms/${joinCode}/join`,
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
      setEnded(false);
      setSession(value);
      setSnapshot(value);
      setConfirmed(true);
      sessionStorage.setItem(sessionKey, JSON.stringify(value));
      setInvite(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      entering.current = false;
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
      setMessages([]);
      setDeparted([]);
      setStatus("Waiting");
      setError("");
      onHome?.();
    } catch (reason) {
      if (ended || /expired|ended|membership required/i.test(String(reason))) {
        sessionStorage.removeItem(sessionKey);
        setSession(undefined);
        setSnapshot(undefined);
        setSelected([]);
        setFiles([]);
        setMessage("");
        setDeparted([]);
        setMessages([]);
        onHome?.();
      } else setError(String(reason));
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
  function notify(value: string) {
    setNotice(value);
  }
  function addFiles(added: File[]) {
    setFiles((previous) => {
      const next = mergeAttachments(previous, added);
      if (next.length > 128) {
        setError("Choose up to 128 files per batch.");
        return previous;
      }
      return next;
    });
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(label);
    } catch {
      setError("Copy unavailable. Select the text and copy it manually.");
    }
  }
  function submitFiles() {
    if (!files.length) {
      notify("Choose a file to send.");
      return;
    }
    if (!selected.length) {
      notify("Select at least one device to send files.");
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1800);
      return;
    }
    if (!session || status !== "Connected") {
      notify(
        "Reconnect to the room before sending. Your attachments are kept.",
      );
      return;
    }
    if (selectedReady.length !== selected.length) {
      notify(
        "A selected device is reconnecting. Wait or change your selection.",
      );
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1800);
      return;
    }
    const batch = [...files],
      recipients = [...selected];
    notify(
      `Preparing ${batch.length} ${batch.length === 1 ? "file" : "files"} for ${recipients.length} ${recipients.length === 1 ? "device" : "devices"}…`,
    );
    for (const id of recipients) void handles.current.get(id)?.sendFiles(batch);
  }
  const roomStatus =
    status === "Connected"
      ? eligible.length === 0
        ? "Waiting for devices"
        : eligible.every((m) => ready(m.id))
          ? "Connected"
          : "Connecting"
      : status;
  const expiresIn = Math.max(
    0,
    Math.ceil(((snapshot?.code_expires || 0) * 1000 - now) / 1000),
  );
  const recipientNames = selected
    .map((id) => snapshot?.members.find((m) => m.id === id))
    .filter((m): m is Member => !!m)
    .map(displayName);
  return (
    <section
      className={
        session ? "room-dashboard" : "room-dashboard entry-panel panel"
      }
      aria-label="Room dashboard"
      data-revision={revision}
    >
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
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
              ? "Enter your invitation"
              : "Name your device"}
          </h2>
          <p>Let the people in your room know it’s you.</p>
          <label>
            Device name
            <input
              autoComplete="nickname"
              maxLength={32}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ashish’s Laptop"
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
          {action === "Join Room" && (confirmed || code) && (
            <>
              <label>
                Room code
                <input
                  className="code-input"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                />
              </label>
              <InvitationScanner
                onCode={(value) => {
                  setCode(value);
                  if (validName(name)) void enter(value);
                  else setError("Enter your device name before joining.");
                }}
              />
            </>
          )}
          <button className="primary" disabled={busy || !validName(name)}>
            {busy
              ? "Connecting…"
              : action === "Join Room" && !confirmed && !code
                ? "Continue"
                : action}
          </button>
          <small>
            No account needed. Only room members see your display name.
          </small>
        </form>
      ) : (
        <>
          <div className="room-heading">
            <div>
              <span className="eyebrow">YOUR SHARED SPACE</span>
              <h1>
                Room workspace{" "}
                <span className="mini-code">{snapshot?.code}</span>
              </h1>
              <p role="status">
                <span className="status-dot" />
                {roomStatus}
              </p>
            </div>
            <div className="room-actions">
              {snapshot?.owner === session.member && (
                <button
                  className="secondary"
                  onClick={() =>
                    sendEvent({ type: "lock", locked: !snapshot.locked })
                  }
                >
                  {snapshot.locked ? <Unlock size={16} /> : <Lock size={16} />}{" "}
                  {snapshot.locked ? "Unlock Room" : "Lock Room"}
                </button>
              )}
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void leave()}
              >
                {snapshot?.owner === session.member ? "End Room" : "Leave Room"}
              </button>
            </div>
          </div>
          {status !== "Connected" && (
            <div className="connection-banner">
              <span>
                {status.startsWith("Reconnect")
                  ? "Reconnecting… Your files are safe in this page."
                  : "Connection unavailable. Your selected files are kept."}
              </span>
              <button onClick={() => retry.current?.()}>
                Retry Connection
              </button>
            </div>
          )}
          <div className="room-grid">
            <div className="workspace-primary">
              <section className="panel room-info" aria-label="Room invitation">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">INVITE YOUR DEVICES</span>
                    <h2>A connection starts here.</h2>
                  </div>
                  <span className="badge">
                    {snapshot?.locked ? "Room locked" : "Private room"}
                  </span>
                </div>
                <div className="invitation-code-row">
                  <strong className="code" data-testid="room-code">
                    {snapshot?.code}
                  </strong>
                  <div className="room-actions">
                    <button
                      className="secondary"
                      onClick={() => void copy(snapshot?.code || "", "Copied!")}
                    >
                      <Copy size={15} /> Copy Code
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void copy(invitation, "Link copied")}
                    >
                      <Copy size={15} /> Copy Invitation Link
                    </button>
                  </div>
                </div>
                <p className="muted">
                  {expiresIn > 0
                    ? `Invitation refreshes in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")}`
                    : "Refreshing invitation…"}{" "}
                  · Only share with people you trust.
                </p>
                <button
                  className="qr-toggle quiet"
                  aria-expanded={invite}
                  onClick={() => setInvite(!invite)}
                >
                  {invite ? <ChevronUp size={17} /> : <ChevronDown size={17} />}{" "}
                  {invite ? "Hide QR code" : "Show QR code"}
                </button>
                {invite && (
                  <div className="qr-content">
                    {qr && (
                      <img
                        src={qr}
                        className="room-qr"
                        alt="Scan room invitation"
                      />
                    )}
                    <div>
                      <h3>Scan. Name. Connect.</h3>
                      <p>
                        Open Join Room on your other device and choose Scan QR.
                        You can also use your phone’s camera.
                      </p>
                    </div>
                  </div>
                )}
              </section>
              <section
                className="panel file-composer"
                aria-label="Send Files"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">DIRECT TO YOUR DEVICES</span>
                    <h2>Send Files</h2>
                  </div>
                  <Paperclip size={22} />
                </div>
                <p className="recipient-hint">
                  {recipientNames.length
                    ? `To: ${recipientNames.join(", ")}`
                    : "Choose recipients in Connected Devices."}
                </p>
                <div className="attachment-dropzone">
                  <input
                    hidden
                    ref={picker}
                    aria-label="Choose files"
                    type="file"
                    multiple
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                  {files.length ? (
                    <ul
                      className="attachments"
                      aria-label="Selected attachments"
                    >
                      {files.map((file, i) => (
                        <li
                          className="attachment"
                          key={file.name + file.size + file.lastModified + i}
                        >
                          <span className="file-icon">
                            <File size={21} />
                          </span>
                          <span className="attachment-name">
                            {file.webkitRelativePath || file.name}
                            <small>{formatSize(file.size)}</small>
                          </span>
                          <button
                            className="icon-button quiet"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setFiles((items) =>
                                items.filter((_, index) => index !== i),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="attachment-empty">
                      <Paperclip size={30} />
                      <h3>Drop files here</h3>
                      <p>Photos, documents, or anything you want to share.</p>
                    </div>
                  )}
                  <div className="composer-toolbar">
                    <div className="attachment-tools">
                      <button
                        className="secondary"
                        onClick={() => picker.current?.click()}
                      >
                        <PlusIcon />{" "}
                        {files.length ? "Add Files" : "Choose Files"}
                      </button>
                      {"webkitdirectory" in document.createElement("input") && (
                        <>
                          <button
                            className="quiet"
                            onClick={() => folderPicker.current?.click()}
                          >
                            <FolderPlus size={17} /> Select Folder
                          </button>
                          <input
                            hidden
                            ref={folderPicker}
                            aria-label="Select folder"
                            type="file"
                            multiple
                            {...{ webkitdirectory: "" }}
                            onChange={(e) => {
                              addFiles(Array.from(e.target.files || []));
                              e.target.value = "";
                            }}
                          />
                        </>
                      )}
                      {files.length > 0 && (
                        <button className="quiet" onClick={() => setFiles([])}>
                          Clear Files
                        </button>
                      )}
                    </div>
                    <button
                      className="primary send-button"
                      aria-label="Send to Selected Devices"
                      onClick={submitFiles}
                    >
                      <Send size={18} /> Send
                    </button>
                  </div>
                </div>
                <div className="composer-summary">
                  <span>
                    {files.length
                      ? `${files.length} ${files.length === 1 ? "file" : "files"} · ${formatSize(files.reduce((sum, f) => sum + f.size, 0))}`
                      : "Files stay selected while this page reconnects."}
                  </span>
                  <span>Receiver approval required</span>
                </div>
              </section>
              <section className="panel text-panel" aria-label="Share Text">
                <div className="section-heading">
                  <h2>Share Text</h2>
                  <span className="badge">{selected.length} selected</span>
                </div>
                <label className="sr-only" htmlFor="room-message">
                  Message
                </label>
                <textarea
                  id="room-message"
                  placeholder="A thought, a link, a little code…"
                  maxLength={12000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="room-actions">
                  <button className="quiet" onClick={() => setMessages([])}>
                    Clear history
                  </button>
                  <button
                    className="secondary"
                    disabled={!message.trim()}
                    onClick={() => {
                      if (!selected.length) {
                        notify("Select at least one device to share text.");
                        return;
                      }
                      if (selectedReady.length !== selected.length) {
                        notify("Wait for the selected devices to connect.");
                        return;
                      }
                      let sent = 0;
                      for (const id of [...selected])
                        if (handles.current.get(id)?.sendText(message)) sent++;
                      if (sent === selected.length) {
                        setMessages((items) =>
                          [{ from: "You", text: message }, ...items].slice(
                            0,
                            30,
                          ),
                        );
                        setMessage("");
                        notify(
                          `Text shared with ${sent} ${sent === 1 ? "device" : "devices"}.`,
                        );
                      } else
                        notify(
                          "Text could not be shared with every selected device. Reconnect or try a shorter message.",
                        );
                    }}
                  >
                    <Send size={16} /> Send Text
                  </button>
                </div>
                {messages.length > 0 ? (
                  <ul className="message-history" aria-label="Text history">
                    {messages.map((item, i) => (
                      <li key={i}>
                        <span>{item.from}</span>
                        <pre>{item.text}</pre>
                        <button
                          className="quiet"
                          aria-label="Copy received text"
                          onClick={() => void copy(item.text, "Text copied")}
                        >
                          Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    Text, links, and code stay as text. Nothing runs
                    automatically.
                  </p>
                )}
              </section>
            </div>
            <aside className="workspace-aside">
              <section
                className={
                  "panel devices-panel " + (highlight ? "attention" : "")
                }
                aria-label="Device selection"
              >
                <div className="section-heading">
                  <h2>Connected Devices</h2>
                  <span className="badge">{snapshot?.members.length}</span>
                </div>
                <p className="muted">
                  Select the devices you want to send files to.
                </p>
                <ul className="room-members" aria-label="Connected Devices">
                  {snapshot?.members.map((m) => (
                    <li key={m.id}>
                      {m.kind === "phone" ? (
                        <Smartphone size={21} />
                      ) : m.kind === "tablet" ? (
                        <Tablet size={21} />
                      ) : (
                        <Monitor size={21} />
                      )}
                      <div className="member-name">
                        <strong>
                          {displayName(m)}
                          {m.id === session.member ? " (you)" : ""}
                        </strong>
                        <small>
                          {m.id === session.member
                            ? status
                            : !m.online
                              ? "Reconnecting"
                              : peers.current.get(m.id)?.state || "Connecting"}
                        </small>
                      </div>
                      {m.id === session.member ? (
                        <button
                          className="icon-button quiet"
                          aria-label="Edit device name"
                          onClick={() => {
                            setName(m.name);
                            setRenaming(!renaming);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      ) : (
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
                      )}{" "}
                      {m.id !== session.member && m.online && !ready(m.id) && (
                        <button
                          className="quiet"
                          onClick={() => retryDevice.current?.(m.id)}
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
                          localStorage.setItem(
                            "flowdrop-device-name",
                            name.trim(),
                          );
                        setRenaming(false);
                      }
                    }}
                  >
                    <label>
                      New device name
                      <input
                        required
                        maxLength={32}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <button className="primary" disabled={!validName(name)}>
                      Save name
                    </button>
                  </form>
                )}
                <div className="room-actions">
                  <button
                    className="quiet"
                    onClick={() => setSelected(eligible.map((m) => m.id))}
                  >
                    Select All
                  </button>
                  <button className="quiet" onClick={() => setSelected([])}>
                    Clear Selection
                  </button>
                  <span className="selection-count">
                    {selected.length} selected
                  </span>
                </div>
              </section>
              <section
                className="panel transfers-panel"
                aria-label="File Transfers"
              >
                <div className="section-heading">
                  <h2>File Transfers</h2>
                  <span className="badge">Live</span>
                </div>
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
                  <div className="empty-transfers">
                    <Send size={25} />
                    <p>Your next transfer starts here.</p>
                    <small>Connect a device, then send a file.</small>
                  </div>
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
                        <OnlinePanel
                          consumer
                          mode="Room transfer"
                          roomLink={{
                            channel: p.channel,
                            room: session.room,
                            token: session.token,
                            member: session.member,
                            remoteName: displayName(m),
                            onMessage: (text) =>
                              setMessages((items) =>
                                [
                                  { from: displayName(m), text },
                                  ...items,
                                ].slice(0, 30),
                              ),
                            onNotice: (value) =>
                              notify(`${displayName(m)}: ${value}`),
                            register: (handle) => {
                              if (handle) handles.current.set(m.id, handle);
                              else handles.current.delete(m.id);
                            },
                          }}
                        />
                        <button
                          className="quiet"
                          disabled={!files.length || !ready(m.id)}
                          onClick={() =>
                            void handles.current
                              .get(m.id)
                              ?.sendFiles([...files])
                          }
                        >
                          Retry files to this device
                        </button>
                      </details>
                    ) : null;
                  })}
              </section>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">＋</span>;
}
