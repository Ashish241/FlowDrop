import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createSHA256 } from "hash-wasm";
import { hashFile } from "./hash";
import { recordTransfer } from "./transfer-history";
import { persistFile, recoverFiles, forgetFile } from "./queue";
import { createStreamSink, type StreamSink } from "./stream-sink";
type Session = {
  room: string;
  token: string;
  member: string;
  expires: number;
  endpoint?: string;
  pairing_code?: string;
  code_expires?: number;
};
type Meta = {
  type: "file";
  id: string;
  name: string;
  size: number;
  sha256: string;
  mime?: string;
};
export function OnlinePanel({
  folders = false,
  consumer = false,
  mode = "Send Files",
}: { folders?: boolean; consumer?: boolean; mode?: string } = {}) {
  const [downloads, setDownloads] = useState<
    Array<{ name: string; blob: Blob }>
  >([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileQueue = useRef<File[]>([]);
  const draining = useRef(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const connectionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const picker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const [recovered, setRecovered] = useState<
    Array<{ id: string; file: File; sha256: string }>
  >([]);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [room, setRoom] = useState(
      new URLSearchParams(location.hash.slice(1)).get("online-room") || "",
    ),
    [status, setStatus] = useState(
      "Create a temporary room or enter an invitation.",
    ),
    [pending, setPending] = useState(false),
    [offer, setOffer] = useState<Meta>(),
    [percent, setPercent] = useState(0),
    [received, setReceived] = useState<{ name: string; blob?: Blob }>(),
    [text, setText] = useState(""),
    [messages, setMessages] = useState<string[]>([]),
    [route, setRoute] = useState("Not connected");
  const [invitation, setInvitation] = useState("");
  const [qr, setQr] = useState("");

  const [pairingCode, setPairingCode] = useState("");
  const [paused, setPaused] = useState(false);
  const localPaused = useRef(false),
    remotePaused = useRef(false);
  const [metrics, setMetrics] = useState({ speed: 0, eta: 0 });
  const [forceRelay, setForceRelay] = useState(false);
  const [iceWarning, setIceWarning] = useState("");
  useEffect(() => {
    if (!invitation) {
      setQr("");
      return;
    }
    void QRCode.toDataURL(invitation).then(setQr);
  }, [invitation]);
  const peer = useRef<RTCPeerConnection | undefined>(undefined),
    socket = useRef<WebSocket | undefined>(undefined),
    channel = useRef<RTCDataChannel | undefined>(undefined),
    session = useRef<Session | undefined>(undefined),
    accept = useRef<(() => void) | undefined>(undefined),
    verified = useRef<((error?: Error) => void) | undefined>(undefined),
    cancelled = useRef(false),
    userCancelled = useRef(false),
    hashing = useRef<AbortController | undefined>(undefined),
    sink = useRef<StreamSink | undefined>(undefined),
    queuedBytes = useRef(0),
    acked = useRef(0),
    sent = useRef(0),
    sending = useRef(false),
    creditWaiters = useRef<Array<(error?: Error) => void>>([]),
    incoming = useRef<Meta | undefined>(undefined),
    offset = useRef(0),
    hash = useRef<Awaited<ReturnType<typeof createSHA256>> | undefined>(
      undefined,
    ),
    candidates = useRef<RTCIceCandidateInit[]>([]),
    receiveChain = useRef(Promise.resolve());
  useEffect(() => {
    const expires = session.current?.code_expires;
    if (!pairingCode || !expires) return;
    const timer = setTimeout(
      () => setPairingCode(""),
      Math.max(0, expires * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pairingCode]);
  const transferRecord = useRef<
    | {
        id: string;
        name: string;
        size: number;
        mime?: string;
        direction: "Send" | "Receive";
      }
    | undefined
  >(undefined);
  useEffect(() => {
    let previous = 0,
      identity = "",
      measured = performance.now();
    const timer = setInterval(() => {
      const record = transferRecord.current;
      if (!record) return;
      const current =
        record.direction === "Send" ? acked.current : offset.current;
      if (record.id !== identity) {
        identity = record.id;
        previous = 0;
        measured = performance.now();
      }
      const now = performance.now(),
        speed =
          localPaused.current || remotePaused.current
            ? 0
            : Math.max(0, current - previous) /
              Math.max(0.001, (now - measured) / 1000);
      previous = current;
      measured = now;
      setMetrics({
        speed,
        eta: speed ? Math.max(0, record.size - current) / speed : 0,
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  async function waitWhilePaused() {
    while ((localPaused.current || remotePaused.current) && !cancelled.current)
      await new Promise((resolve) => setTimeout(resolve, 100));
  }
  useEffect(() => {
    if (transferRecord.current)
      recordTransfer({
        ...transferRecord.current,
        mode: "WebRTC",
        scope: session.current
          ? session.current.member + ":" + session.current.room
          : "",
        sender:
          transferRecord.current.direction === "Send"
            ? "This browser"
            : "Approved room peer",
        receiver:
          transferRecord.current.direction === "Receive"
            ? "This browser"
            : "Approved room peer",
        state: status,
        progress: percent,
      });
  }, [status, percent]);
  useEffect(
    () => () => {
      clearTimeout(expiryTimer.current);
      clearTimeout(connectionTimer.current);
      channel.current?.close();
      peer.current?.close();
      socket.current?.close();
      sink.current?.abort();
    },
    [],
  );
  const base =
    (import.meta as unknown as { env: Record<string, string> }).env
      .VITE_SIGNAL_URL || "/signal";
  async function api(path: string, method = "GET", token?: string) {
    const r = await fetch(base + path, {
      signal: AbortSignal.timeout(70000),
      method,
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const detail =
        typeof body.detail === "string"
          ? body.detail.slice(0, 200)
          : "Check signaling deployment, room expiry and receiver capacity.";
      throw new Error(`Signaling ${r.status}: ${detail}`);
    }
    return r.json();
  }
  function close() {
    clearTimeout(connectionTimer.current);
    setConnected(false);
    setConnecting(false);
    clearTimeout(expiryTimer.current);
    localPaused.current = remotePaused.current = false;
    setPaused(false);
    setMessages([]);
    setText("");
    hashing.current?.abort();
    cancelled.current = true;
    accept.current?.();
    verified.current?.(new Error("Transfer cancelled"));
    for (const waiter of creditWaiters.current.splice(0))
      waiter(new Error("Transfer cancelled"));
    sink.current?.abort();
    sink.current = undefined;
    const oldChannel = channel.current,
      oldPeer = peer.current,
      oldSocket = socket.current;
    channel.current = undefined;
    peer.current = undefined;
    socket.current = undefined;
    oldChannel?.close();
    oldPeer?.close();
    oldSocket?.close();
    incoming.current = undefined;
    setStatus("Disconnected");
    setRoute("Not connected");
  }
  function bind(dc: RTCDataChannel) {
    channel.current = dc;
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 262144;
    dc.onopen = () => {
      if (channel.current !== dc) return;
      clearTimeout(connectionTimer.current);
      cancelled.current = false;
      setConnected(true);
      setConnecting(false);
      setStatus("Connected. Files require receiver approval.");
      void drainQueue();
    };
    dc.onclose = () => {
      if (channel.current !== dc) return;
      setConnected(false);
      cancelled.current = true;
      accept.current?.();
      verified.current?.(new Error("Peer disconnected"));
      for (const waiter of creditWaiters.current.splice(0))
        waiter(new Error("Peer disconnected"));
      sink.current?.abort();
      sink.current = undefined;
      incoming.current = undefined;
      setOffer(undefined);
      setStatus("Peer disconnected; retry by reconnecting.");
    };
    dc.onmessage = (e) => {
      if (channel.current !== dc) return;
      if (typeof e.data === "string") {
        if (e.data.length > 65536) {
          close();
          return;
        }
        try {
          const data = JSON.parse(e.data);
          if (data.type === "pause" && typeof data.paused === "boolean") {
            remotePaused.current = data.paused;
            setPaused(localPaused.current || remotePaused.current);
            return;
          }
          if (data.type === "ack") {
            if (
              !Number.isSafeInteger(data.received) ||
              data.received < acked.current ||
              data.received > sent.current
            ) {
              close();
              return;
            }
            acked.current = data.received;
            if (transferRecord.current?.size)
              setPercent(
                Math.min(
                  99.9,
                  (data.received / transferRecord.current.size) * 100,
                ),
              );
            for (const waiter of creditWaiters.current.splice(0)) waiter();
            return;
          }
        } catch {
          close();
          return;
        }
      }
      const queued =
        typeof e.data === "string"
          ? e.data.length * 2
          : (e.data as ArrayBuffer).byteLength;
      queuedBytes.current += queued;
      if (queuedBytes.current > 2 * 1048576) {
        close();
        setStatus("Peer exceeded receive buffer limit");
        return;
      }
      receiveChain.current = receiveChain.current
        .then(async () => {
          if (channel.current !== dc) return;
          if (typeof e.data === "string") {
            const data = JSON.parse(e.data);
            if (data.type === "file") {
              if (
                incoming.current ||
                sending.current ||
                typeof data.id !== "string" ||
                data.id.length < 1 ||
                data.id.length > 64 ||
                typeof data.name !== "string" ||
                data.name.length > 255 ||
                typeof data.sha256 !== "string" ||
                !/^[a-f0-9]{64}$/.test(data.sha256)
              ) {
                dc.send(JSON.stringify({ type: "reject" }));
                return;
              }
              if (
                !Number.isSafeInteger(data.size) ||
                data.size < 0 ||
                data.size > 20 * 1024 ** 3
              ) {
                dc.send(JSON.stringify({ type: "reject" }));
                setStatus("Online file limit is 20 GiB.");
                return;
              }
              incoming.current = data;
              setPercent(0);
              setStatus("Incoming file waiting for approval");
              transferRecord.current = {
                id: data.id,
                name: data.name,
                size: data.size,
                mime:
                  typeof data.mime === "string"
                    ? data.mime.slice(0, 100)
                    : "application/octet-stream",
                direction: "Receive",
              };
              hash.current = undefined;
              setOffer(data);
              setReceived(undefined);
            } else if (data.type === "accept") {
              accept.current?.();
            } else if (data.type === "reject" || data.type === "cancel") {
              localPaused.current = remotePaused.current = false;
              setPaused(false);
              userCancelled.current = true;
              hashing.current?.abort();
              verified.current?.(new Error("Transfer rejected or cancelled"));
              for (const waiter of creditWaiters.current.splice(0))
                waiter(new Error("Transfer rejected or cancelled"));
              cancelled.current = true;
              accept.current?.();
              incoming.current = undefined;
              sink.current?.abort();
              sink.current = undefined;
              setOffer(undefined);
              setStatus("Transfer cancelled or rejected.");
            } else if (data.type === "finish" && incoming.current) {
              const meta = incoming.current;
              if (
                offset.current !== meta.size ||
                hash.current?.digest("hex") !== meta.sha256
              ) {
                setStatus("Integrity verification failed.");
                sink.current?.abort();
                sink.current = undefined;
              } else {
                const blob = await sink.current?.close();
                sink.current = undefined;
                setReceived({ name: meta.name, blob });
                if (blob && consumer)
                  setDownloads((items) => [
                    ...items,
                    { name: meta.name, blob },
                  ]);
                setStatus(
                  blob
                    ? "Completed · SHA-256 verified; choose Save to download"
                    : "Completed · SHA-256 verified; handed to browser downloads",
                );
                setPercent(100);
                dc.send(JSON.stringify({ type: "verified" }));
              }
              incoming.current = undefined;
              setOffer(undefined);
            } else if (data.type === "verified") {
              verified.current?.();
              setStatus("Delivered · receiver SHA-256 verified");
              setPercent(100);
            } else if (
              data.type === "text" &&
              typeof data.text === "string" &&
              data.text.length <= 65536
            )
              setMessages((h) => [data.text, ...h].slice(0, 100));
          } else if (incoming.current && hash.current && sink.current) {
            const bytes = e.data as ArrayBuffer;
            if (
              bytes.byteLength > 65536 ||
              offset.current + bytes.byteLength > incoming.current.size
            )
              throw new Error("Invalid data frame");
            hash.current.update(new Uint8Array(bytes));
            offset.current += bytes.byteLength;
            await sink.current.write(new Uint8Array(bytes));
            dc.send(JSON.stringify({ type: "ack", received: offset.current }));
            setPercent(
              incoming.current.size
                ? Math.min(99.9, (offset.current / incoming.current.size) * 100)
                : 99.9,
            );
          }
        })
        .finally(() => {
          if (channel.current === dc)
            queuedBytes.current = Math.max(0, queuedBytes.current - queued);
        })
        .catch((e) => {
          if (channel.current !== dc) return;
          close();
          setStatus("Transfer failed: " + String(e));
        });
    };
  }
  async function connect(join: boolean, recovering = false) {
    if (connecting) return;
    try {
      let joinRoom = room.trim();
      if (join) {
        let value = room.trim();
        if (!/^(?:[a-f0-9]{32}|[0-9]{6})$/.test(value)) {
          try {
            const link = new URL(value);
            if (link.origin !== location.origin) throw new Error();
            value =
              new URLSearchParams(link.hash.slice(1)).get("online-room") || "";
          } catch {
            throw new Error(
              "Use a six-digit pairing code, room ID or an invitation from this website.",
            );
          }
        }
        if (!/^(?:[a-f0-9]{32}|[0-9]{6})$/.test(value))
          throw new Error("Invalid room ID or code.");
        setRoom(value);
        joinRoom = value;
      }
      transferRecord.current = undefined;
      close();
      cancelled.current = false;
      setConnecting(true);
      setStatus("Connecting");
      setPending(false);
      setReceived(undefined);
      if (!recovering) setDownloads([]);
      candidates.current = [];
      setSharing(true);
      const saved = sessionStorage.getItem("flowdrop.online.v2");
      if (recovering && !saved)
        throw new Error("No saved room. Create or join a room first.");
      const data = (
        recovering && saved
          ? JSON.parse(saved)
          : await api(join ? "/rooms/" + joinRoom + "/join" : "/rooms", "POST")
      ) as Session;
      if (
        !/^[a-f0-9]{32}$/.test(data.room) ||
        typeof data.token !== "string" ||
        typeof data.expires !== "number"
      )
        throw new Error("Invalid signaling session response.");
      const endpoint = new URL(base, location.href).href;
      if (data.endpoint && data.endpoint !== endpoint)
        throw new Error(
          "Saved room belongs to a different signaling endpoint. Create a fresh room.",
        );
      data.endpoint = endpoint;
      if (data.expires <= Date.now() / 1000) {
        sessionStorage.removeItem("flowdrop.online.v2");
        throw new Error("Room expired. Create or join a new room.");
      }
      sessionStorage.setItem("flowdrop.online.v2", JSON.stringify(data));
      session.current = data;
      expiryTimer.current = setTimeout(
        () => {
          if (session.current !== data) return;
          close();
          session.current = undefined;
          sessionStorage.removeItem("flowdrop.online.v2");
          setRecovered([]);
          setStatus("Room expired; transfers stopped.");
        },
        Math.max(0, data.expires * 1000 - Date.now()),
      );
      setRecovered(
        await recoverFiles(await hashFile(new Blob([data.token]))).catch(
          () => [],
        ),
      );
      setRoom(data.room);
      setPairingCode(data.pairing_code || "");
      setInvitation(
        location.origin + location.pathname + "#online-room=" + data.room,
      );
      let ice = await api("/ice", "GET", data.token);
      let pc: RTCPeerConnection;
      const ws = new WebSocket(
        new URL(
          base + "/rooms/" + data.room + "/ws",
          location.href,
        ).href.replace(/^http/, "ws"),
      );
      socket.current = ws;
      connectionTimer.current = setTimeout(() => {
        if (socket.current !== ws || ws.readyState === WebSocket.OPEN) return;
        close();
        setStatus(
          "Connection failed. The sharing service may be waking up. Retry; your files are still selected.",
        );
      }, 25000);
      function resetPeer() {
        setConnected(false);
        const old = channel.current;
        channel.current = undefined;
        old?.close();
        peer.current?.close();
        sink.current?.abort();
        sink.current = undefined;
        incoming.current = undefined;
        setOffer(undefined);
        accept.current?.();
        verified.current?.(
          new Error("Peer reconnected; resend the interrupted file"),
        );
        for (const waiter of creditWaiters.current.splice(0))
          waiter(new Error("Peer reconnected"));
        cancelled.current = true;
        queuedBytes.current = 0;
        receiveChain.current = Promise.resolve();
        if (forceRelay && !ice.turnConfigured)
          throw new Error(
            "Relay-only testing requires configured authenticated TURN servers.",
          );
        setIceWarning(
          !ice.stunConfigured && !ice.turnConfigured
            ? "No STUN/TURN configured: same-network connectivity only; Internet reachability is not established."
            : !ice.turnConfigured
              ? "STUN configured; TURN is missing, so restrictive NAT/firewalls may prevent connections."
              : "Authenticated short-lived TURN fallback configured. Internet reachability still requires different-network testing.",
        );
        pc = new RTCPeerConnection({
          iceServers: ice.iceServers,
          iceTransportPolicy: forceRelay
            ? "relay"
            : ice.iceTransportPolicy || "all",
        });
        const instance = pc;
        let hasRelay = false;
        peer.current = pc;
        pc.onicecandidate = (e) => {
          if (peer.current !== instance) return;
          if (e.candidate?.type === "relay") hasRelay = true;
          if (e.candidate && ws.readyState === WebSocket.OPEN)
            ws.send(
              JSON.stringify({ type: "ice", candidate: e.candidate.toJSON() }),
            );
        };
        pc.onicecandidateerror = (event) => {
          if (peer.current === instance)
            setIceWarning(
              `ICE server request failed (${event.errorCode}). Check STUN/TURN host, port, transport and firewall; a public STUN server does not guarantee connectivity.`,
            );
        };
        pc.onicegatheringstatechange = () => {
          if (
            peer.current === instance &&
            pc.iceGatheringState === "complete" &&
            (forceRelay || ice.iceTransportPolicy === "relay") &&
            !hasRelay
          )
            setIceWarning(
              "No TURN relay candidate was allocated. Check TURN reachability, credentials and UDP/TCP transport.",
            );
        };
        pc.ondatachannel = (e) => {
          if (peer.current === instance) bind(e.channel);
        };
        pc.onconnectionstatechange = () => {
          if (peer.current !== instance) return;
          if (pc.connectionState === "connecting") {
            clearTimeout(connectionTimer.current);
            connectionTimer.current = setTimeout(() => {
              if (
                peer.current !== instance ||
                channel.current?.readyState === "open"
              )
                return;
              close();
              setStatus(
                "Connection failed. This network could not reach the other device. Try another network, then retry. Your files are still selected.",
              );
            }, 45000);
          }
          if (pc.connectionState === "failed") {
            setConnected(false);
            setConnecting(false);
            setStatus(
              hasRelay
                ? "TURN allocated a relay candidate, but connectivity checks failed. Check relay public address, permissions and relay-port firewall; reconnect to retry."
                : "WebRTC connection failed. Check NAT/firewall restrictions and configure authenticated TURN; reconnect to retry.",
            );
          } else if (pc.connectionState !== "connected")
            setStatus(pc.connectionState);
          else if (channel.current?.readyState === "open")
            setStatus("Connected. Files require receiver approval.");
          if (pc.connectionState === "connected")
            void pc.getStats().then((stats) => {
              const transport = [...stats.values()].find(
                (stat) =>
                  stat.type === "transport" && stat.selectedCandidatePairId,
              );
              const selected = transport
                ? stats.get(transport.selectedCandidatePairId)
                : [...stats.values()].find(
                    (stat) =>
                      stat.type === "candidate-pair" &&
                      stat.state === "succeeded" &&
                      stat.nominated,
                  );
              if (!selected) {
                setRoute("Connected; selected ICE route unavailable");
                return;
              }
              const local = stats.get(selected.localCandidateId),
                remote = stats.get(selected.remoteCandidateId);
              setRoute(
                local?.candidateType === "relay" ||
                  remote?.candidateType === "relay"
                  ? "TURN relay"
                  : "Direct P2P",
              );
            });
        };
      }
      resetPeer();
      ws.onopen = () => {
        if (socket.current !== ws) return;
        clearTimeout(connectionTimer.current);
        setConnecting(false);
        ws.send(data.token);
        setStatus(
          join
            ? "Waiting for owner approval"
            : "Room ready. Share the invitation code.",
        );
      };
      let signalingChain = Promise.resolve();
      ws.onmessage = (e) => {
        signalingChain = signalingChain
          .then(async () => {
            if (socket.current !== ws) return;
            const msg = JSON.parse(e.data);
            if (msg.type === "join-request") setPending(true);
            if (msg.type === "ready") {
              ice = await api("/ice", "GET", data.token);
              resetPeer();
              candidates.current = [];
              const dc = pc.createDataChannel("flowdrop", { ordered: true });
              bind(dc);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
            }
            if (msg.type === "offer") {
              ice = await api("/ice", "GET", data.token);
              resetPeer();
              await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
              for (const candidate of candidates.current)
                await pc.addIceCandidate(candidate);
              candidates.current = [];
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
            }
            if (msg.type === "answer") {
              await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
              for (const candidate of candidates.current)
                await pc.addIceCandidate(candidate);
              candidates.current = [];
            }
            if (msg.type === "ice") {
              if (
                !msg.candidate ||
                typeof msg.candidate.candidate !== "string" ||
                msg.candidate.candidate.length > 2048 ||
                candidates.current.length >= 256
              ) {
                close();
                setStatus("Invalid or excessive ICE candidates");
                return;
              }
              if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
              else candidates.current.push(msg.candidate);
            }
          })
          .catch((e) => setStatus(String(e)));
      };
      ws.onerror = () => {
        if (socket.current !== ws) return;
        setConnecting(false);
        setStatus(
          "Signaling connection failed. Check network, HTTPS, origin configuration, and TURN availability.",
        );
      };
      ws.onclose = (event) => {
        if (socket.current !== ws) return;
        setConnecting(false);
        if (event.code === 1008) {
          close();
          session.current = undefined;
          sessionStorage.removeItem("flowdrop.online.v2");
          setRecovered([]);
          setStatus("Room expired or revoked; transfers stopped.");
          return;
        }
        setStatus(
          "Signaling disconnected. Reconnect the saved room; interrupted files must be resent.",
        );
      };
    } catch (e) {
      setConnecting(false);
      setStatus(String(e));
    }
  }
  async function send(file?: File, recoveryId?: string) {
    if (!file) return false;
    if (sending.current) {
      setStatus("Another file is still in progress.");
      return false;
    }
    sending.current = true;
    setBusy(true);
    let completed = false;
    transferRecord.current = undefined;
    userCancelled.current = false;
    const sourceSession = session.current;
    const hashController = new AbortController();
    hashing.current = hashController;
    let persistedId: string | undefined;
    setPercent(0);
    acked.current = 0;
    sent.current = 0;
    function waitForCredit() {
      return new Promise<void>((resolve, reject) => {
        let timer = setTimeout(function timeout() {
          if (localPaused.current || remotePaused.current) {
            timer = setTimeout(timeout, 30000);
            return;
          }
          const index = creditWaiters.current.indexOf(done);
          if (index >= 0) creditWaiters.current.splice(index, 1);
          reject(new Error("Receiver stopped acknowledging chunks"));
        }, 30000);
        function done(error?: Error) {
          clearTimeout(timer);
          if (error) reject(error);
          else resolve();
        }
        creditWaiters.current.push(done);
      });
    }
    try {
      const dc = channel.current;
      if (incoming.current)
        throw new Error(
          "Finish or cancel the incoming file before sending another file.",
        );
      if (!dc || dc.readyState !== "open")
        throw new Error("Connect to a peer first.");
      if (file.size > 20 * 1024 ** 3)
        throw new Error("Current online limit is 20 GiB.");
      cancelled.current = false;
      setStatus("Checking file SHA-256");
      const digest = await hashFile(file, hashController.signal);
      if (cancelled.current || sourceSession !== session.current) return;
      transferRecord.current = {
        id:
          recoveryId ||
          Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        direction: "Send",
      };
      persistedId = transferRecord.current.id;
      try {
        await persistFile({
          id: transferRecord.current.id,
          scope: await hashFile(new Blob([sourceSession!.token])),
          file,
          sha256: digest,
        });
      } catch {
        setStatus(
          "Browser persistence unavailable; keep this page open or reselect the file after reconnecting.",
        );
      }
      if (cancelled.current || sourceSession !== session.current) return;
      setStatus("Waiting for receiver approval");
      await new Promise<void>((resolve) => {
        accept.current = resolve;
        dc.send(
          JSON.stringify({
            type: "file",
            id: transferRecord.current!.id,
            name: file.name,
            size: file.size,
            mime: file.type || "application/octet-stream",
            sha256: digest,
          }),
        );
      });
      if (cancelled.current) return;
      setStatus("Transferring file with receiver acknowledgements");
      for (let start = 0; start < file.size; start += 65536) {
        await waitWhilePaused();
        if (cancelled.current) break;
        while (
          start + Math.min(65536, file.size - start) - acked.current >
          1048576
        )
          await waitForCredit();
        while (dc.bufferedAmount > 1048576) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => finish(new Error("Peer stopped receiving")),
              30000,
            );
            const low = () => finish();
            const aborted = () => finish(new Error("Transfer cancelled"));
            const finish = (error?: Error) => {
              clearTimeout(timeout);
              dc.removeEventListener("bufferedamountlow", low);
              hashController.signal.removeEventListener("abort", aborted);
              if (error) reject(error);
              else resolve();
            };
            dc.addEventListener("bufferedamountlow", low, { once: true });
            if (hashController.signal.aborted) aborted();
            else
              hashController.signal.addEventListener("abort", aborted, {
                once: true,
              });
          });
        }
        if (cancelled.current) break;
        await waitWhilePaused();
        if (cancelled.current) break;
        dc.send(await file.slice(start, start + 65536).arrayBuffer());
        sent.current = Math.min(file.size, start + 65536);
        setPercent(
          Math.min(99.9, (acked.current / Math.max(1, file.size)) * 100),
        );
      }
      if (!cancelled.current) {
        while (acked.current < file.size) await waitForCredit();
        const verification = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            verified.current = undefined;
            reject(
              new Error(
                "Receiver verification timed out; resend the file after reconnecting",
              ),
            );
          }, 30000);
          verified.current = (error) => {
            clearTimeout(timer);
            verified.current = undefined;
            if (error) reject(error);
            else resolve();
          };
        });
        dc.send(JSON.stringify({ type: "finish" }));
        setStatus("Sent; receiver verifies the hash.");
        await verification;
        completed = true;
        await forgetFile(transferRecord.current!.id).catch(() => undefined);
        setRecovered((items) =>
          items.filter((item) => item.id !== transferRecord.current?.id),
        );
      }
    } catch (e) {
      if (sourceSession === session.current)
        setStatus(userCancelled.current ? "Transfer cancelled" : String(e));
    } finally {
      if (userCancelled.current && persistedId)
        await forgetFile(persistedId).catch(() => undefined);
      if (hashing.current === hashController) hashing.current = undefined;
      sending.current = false;
      setBusy(false);
    }
    return completed;
  }
  async function drainQueue() {
    if (draining.current || channel.current?.readyState !== "open") return;
    draining.current = true;
    try {
      while (
        fileQueue.current.length &&
        channel.current?.readyState === "open"
      ) {
        const file = fileQueue.current[0];
        const success = await send(file);
        if (!success) break;
        fileQueue.current = fileQueue.current.filter((item) => item !== file);
        setSelectedFiles([...fileQueue.current]);
      }
    } finally {
      draining.current = false;
    }
  }
  async function selectFiles(files: File[]) {
    fileQueue.current.push(...files);
    setSelectedFiles([...fileQueue.current]);
    if (channel.current?.readyState === "open") {
      cancelled.current = false;
      await drainQueue();
    } else setStatus("Ready to share. Your files are selected.");
  }
  async function acceptFile() {
    if (!offer) return;

    const approved = offer;
    setOffer(undefined);
    const receivingChannel = channel.current;
    const decoder = await createSHA256();
    decoder.init();
    if (incoming.current !== approved || channel.current !== receivingChannel)
      return;
    try {
      const created = await createStreamSink(approved.name, approved.size);
      if (
        consumer &&
        created.buffered &&
        downloads.reduce((n, item) => n + item.blob.size, 0) + approved.size >
          128 * 1024 * 1024
      ) {
        created.abort();
        throw new Error(
          "Save your previous files before accepting another download.",
        );
      }
      if (
        incoming.current !== approved ||
        channel.current !== receivingChannel
      ) {
        created.abort();
        return;
      }
      sink.current = created;
      hash.current = decoder;
      offset.current = 0;
    } catch (e) {
      if (incoming.current !== approved || channel.current !== receivingChannel)
        return;
      setStatus(String(e));
      channel.current?.send(JSON.stringify({ type: "reject" }));
      incoming.current = undefined;
      setOffer(undefined);
      return;
    }
    channel.current?.send(JSON.stringify({ type: "accept" }));
    setStatus("Receiving and verifying file");
    setOffer(undefined);
  }
  function cancelTransfer() {
    localPaused.current = remotePaused.current = false;
    setPaused(false);
    userCancelled.current = true;
    hashing.current?.abort();
    cancelled.current = true;
    incoming.current = undefined;
    sink.current?.abort();
    sink.current = undefined;
    setOffer(undefined);
    accept.current?.();
    verified.current?.(new Error("Transfer cancelled"));
    for (const waiter of creditWaiters.current.splice(0))
      waiter(new Error("Transfer cancelled"));
    channel.current?.send(JSON.stringify({ type: "cancel" }));
    setStatus("Transfer cancelled");

    fileQueue.current = [];
    setSelectedFiles([]);
  }
  function togglePause() {
    if (channel.current?.readyState !== "open") return;
    localPaused.current = !localPaused.current;
    setPaused(localPaused.current || remotePaused.current);
    channel.current.send(
      JSON.stringify({ type: "pause", paused: localPaused.current }),
    );
  }
  async function endShare() {
    const current = session.current;
    try {
      if (current?.member === "owner")
        await api(`/rooms/${current.room}`, "DELETE", current.token);
      if (current) {
        const stored = await recoverFiles(
          await hashFile(new Blob([current.token])),
        ).catch(() => []);
        await Promise.all(stored.map((item) => forgetFile(item.id))).catch(
          () => undefined,
        );
      }
      close();
      session.current = undefined;
      sessionStorage.removeItem("flowdrop.online.v2");
      setSharing(false);
      setDownloads([]);
      setReceived(undefined);
      setRecovered([]);
      transferRecord.current = undefined;
      setPercent(0);
      setInvitation("");
      setPairingCode("");
      setStatus("Ready to share");
    } catch {
      setStatus(
        "Connection failed. Could not end this share. Retry ending the share.",
      );
    }
  }
  const technicalPanel = (
    <section className="panel">
      <h2>Online peer-to-peer</h2>
      <p>
        Use the hosted signaling service. File bytes travel over an encrypted
        WebRTC DataChannel.
      </p>
      <p>{iceWarning}</p>
      <label>
        <input
          type="checkbox"
          checked={forceRelay}
          onChange={(event) => setForceRelay(event.target.checked)}
        />
        Relay-only test (requires TURN; reconnect after changing)
      </label>
      {pairingCode && (
        <p>
          Pairing code:{" "}
          <strong data-testid="pairing-code">{pairingCode}</strong> · valid for
          10 minutes; owner approval required
        </p>
      )}
      {invitation && (
        <div>
          <p>
            Invitation URL: <a href={invitation}>{invitation}</a>
          </p>
          <img src={qr} alt="Scan online room invitation" />
          <p>
            Invitation contains a room ID only. Owner approval and separate file
            acceptance are required.
          </p>
        </div>
      )}
      <label>
        Room invitation
        <input value={room} onChange={(e) => setRoom(e.target.value)} />
      </label>
      <button onClick={() => void connect(false)}>Create room</button>{" "}
      <button onClick={() => void connect(true)}>Join room</button>{" "}
      <button onClick={close}>Disconnect</button>
      <button
        disabled={session.current?.member !== "owner"}
        onClick={() =>
          void (async () => {
            const current = session.current;
            if (!current || current.member !== "owner")
              throw new Error("Only the room owner can end this room.");
            const pending = await recoverFiles(
              await hashFile(new Blob([current.token])),
            );
            await api(`/rooms/${current.room}`, "DELETE", current.token);
            close();
            session.current = undefined;
            sessionStorage.removeItem("flowdrop.online.v2");
            setRecovered([]);
            await Promise.all(pending.map((item) => forgetFile(item.id)));
            setStatus("Room ended and signaling capabilities revoked.");
          })().catch((e) => setStatus(String(e)))
        }
      >
        End room
      </button>
      <button onClick={() => void connect(false, true)}>
        Reconnect saved room
      </button>
      {recovered.length > 0 && (
        <div>
          <p>
            {recovered.length} pending file(s) recovered for this room. Each
            resend requires fresh recipient file approval.
          </p>
          <button
            onClick={() =>
              void (async () => {
                for (const item of recovered) {
                  if ((await hashFile(item.file)) !== item.sha256)
                    throw new Error(
                      "Stored file changed; reselect the original",
                    );
                  await send(item.file, item.id);
                }
              })().catch((e) => setStatus(String(e)))
            }
          >
            Resume pending sends
          </button>
          <button
            onClick={() =>
              void Promise.all(
                recovered.map((item) => forgetFile(item.id)),
              ).then(() => setRecovered([]))
            }
          >
            Discard pending sends
          </button>
        </div>
      )}
      {pending && (
        <p>
          <button
            onClick={() => {
              socket.current?.send(JSON.stringify({ type: "approve" }));
              setPending(false);
            }}
          >
            Approve receiver
          </button>
        </p>
      )}
      <p role="status">
        {status} · {route}
      </p>
      <label>
        Select files (up to 20 GiB each)
        <input
          type="file"
          multiple
          onChange={async (e) => {
            const selected = Array.from(e.target.files || []);
            e.currentTarget.value = "";
            await selectFiles(selected);
          }}
        />
      </label>
      {folders && "webkitdirectory" in document.createElement("input") && (
        <label>
          Choose folder contents (files are saved separately)
          <input
            type="file"
            multiple
            {...{ webkitdirectory: "" }}
            onChange={async (event) => {
              const selected = Array.from(event.target.files || []);
              event.currentTarget.value = "";
              cancelled.current = false;
              for (const file of selected) {
                if (cancelled.current) break;
                await send(file);
              }
            }}
          />
        </label>
      )}
      {transferRecord.current && (
        <p>
          {transferRecord.current.name} ·{" "}
          {transferRecord.current.size.toLocaleString()} bytes ·{" "}
          {transferRecord.current.mime || "application/octet-stream"} ·{" "}
          {transferRecord.current.direction} · Approved room peer
        </p>
      )}
      <p>
        {percent.toFixed(1)}% · {Math.round(metrics.speed / 1024)} KiB/s ·{" "}
        {metrics.eta
          ? Math.ceil(metrics.eta) + "s remaining"
          : "ETA unavailable"}{" "}
        {paused
          ? "· Paused: resume on the device that paused; in-flight chunks may settle"
          : ""}
      </p>
      <progress aria-label="Transfer progress" max={100} value={percent} />
      <button
        disabled={channel.current?.readyState !== "open"}
        onClick={() => {
          localPaused.current = !localPaused.current;
          setPaused(localPaused.current || remotePaused.current);
          channel.current?.send(
            JSON.stringify({ type: "pause", paused: localPaused.current }),
          );
        }}
      >
        {localPaused.current ? "Resume transfer" : "Pause transfer"}
      </button>
      {offer && (
        <p>
          {offer.name} · {offer.size} bytes{" "}
          <button onClick={() => void acceptFile()}>Accept file</button>{" "}
          <button
            onClick={() => {
              channel.current?.send(JSON.stringify({ type: "reject" }));
              setOffer(undefined);
              incoming.current = undefined;
            }}
          >
            Reject
          </button>
        </p>
      )}
      <button disabled={!busy && !incoming.current} onClick={cancelTransfer}>
        Cancel transfer
      </button>
      {received?.blob && (
        <p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(received.blob!);
              const a = document.createElement("a");
              a.href = url;
              a.download = received.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
          >
            Save {received.name}
          </button>
        </p>
      )}
      {received && !received.blob && (
        <p>Verified file streamed to your browser downloads.</p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={65536}
        placeholder="Share text with your peer"
      />
      <button
        disabled={!connected || !text.trim()}
        onClick={() => {
          if (channel.current?.readyState === "open") {
            channel.current.send(JSON.stringify({ type: "text", text }));
            setText("");
          } else setStatus("Connect first.");
        }}
      >
        Send text
      </button>
      <button onClick={() => setText("")}>Clear text</button>
      <button onClick={() => setMessages([])}>Clear received history</button>
      {messages.map((message, index) => (
        <div key={index}>
          <pre>{message}</pre>
          <button
            onClick={() => {
              if (navigator.clipboard && window.isSecureContext)
                void navigator.clipboard
                  .writeText(message)
                  .catch(() =>
                    setStatus(
                      "Copy permission denied; select the text to copy manually.",
                    ),
                  );
              else
                setStatus(
                  "Select the text to copy manually; clipboard requires HTTPS or localhost.",
                );
            }}
          >
            Copy received text
          </button>
        </div>
      ))}
      <p className="muted">
        Direct connections depend on network conditions. TURN is configured by
        the operator. Secure browsers stream downloads with a 1 MiB
        acknowledgement window. Browsers without Service Worker support use a
        128 MiB fallback. Interrupted online transfers require resending.
      </p>
    </section>
  );
  if (!consumer) return technicalPanel;
  const failure = /failed|Error:|expired|revoked|disconnected|timed out/i.test(
    status,
  );
  const completed = /Completed|Delivered/.test(status);
  const label = /cancelled|rejected/.test(status)
    ? "Transfer cancelled"
    : status === "File declined"
      ? "File declined"
      : completed
        ? "Completed"
        : paused
          ? "Paused"
          : busy && !status.includes("approval")
            ? "Sending"
            : incoming.current && !offer
              ? "Receiving"
              : offer
                ? "Incoming file"
                : status.includes("approval")
                  ? "Waiting for approval"
                  : connected
                    ? "Connected"
                    : failure
                      ? "Connection failed"
                      : sharing
                        ? session.current?.member === "owner"
                          ? "Waiting for receiver"
                          : "Connecting"
                        : "Ready to share";
  return (
    <section className="panel share-flow" aria-label="File sharing">
      <p role="status" className={failure ? "flow-state error" : "flow-state"}>
        {label}
      </p>
      {mode !== "Receive Files" && (
        <div
          className="dropzone"
          hidden={sharing && (!completed || busy)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void selectFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <h2>
            {mode === "Share Text"
              ? "Share a thought, a link, anything."
              : "Drop your files here"}
          </h2>
          <p>Private sharing, straight to the other device.</p>
          <button className="primary" onClick={() => picker.current?.click()}>
            Browse Files
          </button>
          <input
            hidden
            ref={picker}
            aria-label="Browse Files"
            type="file"
            multiple
            onChange={(e) => {
              void selectFiles(Array.from(e.target.files || []));
              e.currentTarget.value = "";
            }}
          />
          {folders && "webkitdirectory" in document.createElement("input") && (
            <>
              <button
                className="secondary"
                onClick={() => folderPicker.current?.click()}
              >
                Select Folder
              </button>
              <input
                hidden
                ref={folderPicker}
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                onChange={(e) => {
                  void selectFiles(Array.from(e.target.files || []));
                  e.currentTarget.value = "";
                }}
              />
            </>
          )}
        </div>
      )}
      {selectedFiles.length > 0 && (
        <ul className="selected-files" aria-label="Selected files">
          {selectedFiles.map((f, i) => (
            <li key={i}>
              <span>{f.name}</span>
              <small>{(f.size / 1024).toFixed(1)} KB</small>
            </li>
          ))}
        </ul>
      )}
      {!sharing && mode !== "Receive Files" && (
        <button
          className="primary"
          disabled={
            connecting || (mode !== "Share Text" && !selectedFiles.length)
          }
          onClick={() => void connect(false)}
        >
          Continue
        </button>
      )}
      {!sharing && mode === "Receive Files" && (
        <div className="join-flow">
          <h2>Enter your sharing code</h2>
          <label>
            Pairing code
            <input
              aria-label="Pairing code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="482 916"
              value={room}
              onChange={(e) => setRoom(e.target.value.replace(/\s/g, ""))}
            />
          </label>
          <button
            className="primary"
            disabled={connecting || !room}
            onClick={() => void connect(true)}
          >
            Join
          </button>
          <p>
            Or open the sender·s invitation link. Scan their QR with your camera
            app.
          </p>
        </div>
      )}
      {sharing && !connected && session.current?.member === "owner" && (
        <div className="invitation">
          <h2>Your sharing code</h2>
          {pairingCode ? (
            <strong data-testid="pairing-code" className="code">
              {pairingCode.slice(0, 3)} {pairingCode.slice(3)}
            </strong>
          ) : (
            <p>Code expired. Start a new share.</p>
          )}
          <p>Expires in 10 minutes. Only approve someone you know.</p>
          {qr && <img src={qr} alt="Scan online room invitation" />}
          <button
            className="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(invitation)
                .then(() => setCopyStatus("Link copied"))
                .catch(() =>
                  setCopyStatus(
                    "Copy unavailable. Open the invitation link to copy it.",
                  ),
                )
            }
          >
            Copy Invitation Link
          </button>
          {copyStatus && <p>{copyStatus}</p>}
        </div>
      )}
      {pending && (
        <div className="incoming">
          <h2>Someone wants to connect</h2>
          <p>Confirm this is the person you invited.</p>
          <button
            className="primary"
            onClick={() => {
              socket.current?.send(JSON.stringify({ type: "approve" }));
              setPending(false);
            }}
          >
            Approve receiver
          </button>
        </div>
      )}
      {offer && (
        <div className="incoming">
          <h2>{offer.name}</h2>
          <p>{offer.size.toLocaleString()} bytes</p>
          <button className="primary" onClick={() => void acceptFile()}>
            Accept file
          </button>
          <button
            className="secondary"
            onClick={() => {
              channel.current?.send(JSON.stringify({ type: "reject" }));
              incoming.current = undefined;
              setOffer(undefined);
              setStatus("File declined");
            }}
          >
            Decline
          </button>
        </div>
      )}
      {transferRecord.current && (
        <div className="transfer-card">
          <h2>{transferRecord.current.name}</h2>
          <progress aria-label="Transfer progress" max={100} value={percent} />
          <p>
            {percent.toFixed(1)}% · {Math.round(metrics.speed / 1024)} KB/s
            {metrics.eta ? ` · ${Math.ceil(metrics.eta)}s remaining` : ""}
          </p>
          {completed && (
            <p>
              Integrity verified.{" "}
              {transferRecord.current.direction === "Receive"
                ? received?.blob
                  ? "Choose Save to download."
                  : "Check your browser downloads."
                : "Received by the other device."}
            </p>
          )}
        </div>
      )}
      {(busy || incoming.current) && (
        <div className="flow-actions">
          <button disabled={!connected} onClick={togglePause}>
            {localPaused.current ? "Resume transfer" : "Pause transfer"}
          </button>
          <button className="secondary" onClick={cancelTransfer}>
            Cancel transfer
          </button>
        </div>
      )}
      {downloads.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            const url = URL.createObjectURL(item.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = item.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            setDownloads((items) => items.filter((entry) => entry !== item));
          }}
        >
          Save {item.name}
        </button>
      ))}
      {failure && (
        <div className="flow-error">
          <p>
            {/expired|revoked|404/.test(status)
              ? "This share has expired. Start a new share or ask for a fresh code."
              : "We couldn't connect or finish this transfer. Keep both pages open, try another trusted network, then retry. Your selected files are retained."}
          </p>
          <button
            disabled={connecting}
            onClick={() =>
              void connect(mode === "Receive Files", !!session.current)
            }
          >
            Retry connection
          </button>
          <button
            className="secondary"
            onClick={() => {
              close();
              session.current = undefined;
              setSharing(false);
              setDownloads([]);
              setReceived(undefined);
              transferRecord.current = undefined;
              setPercent(0);
              setInvitation("");
              setPairingCode("");
              setStatus("Ready to share");
            }}
          >
            Start a new share
          </button>
        </div>
      )}
      {connected && !busy && selectedFiles.length > 0 && (
        <button
          disabled={busy}
          onClick={() => {
            cancelled.current = false;
            void drainQueue();
          }}
        >
          Retry selected files
        </button>
      )}
      {connected && (
        <details className="text-share" open={mode === "Share Text"}>
          <summary>Share text</summary>
          <label>
            Message
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={65536}
            />
          </label>
          <button
            disabled={!connected || !text.trim()}
            onClick={() => {
              channel.current?.send(JSON.stringify({ type: "text", text }));
              setText("");
            }}
          >
            Send text
          </button>
          {messages.map((m, i) => (
            <pre key={i}>{m}</pre>
          ))}
        </details>
      )}
      {connected && completed && mode !== "Receive Files" && (
        <button className="secondary" onClick={() => picker.current?.click()}>
          Send another file
        </button>
      )}
      {connected && completed && mode === "Receive Files" && (
        <button
          className="secondary"
          onClick={() => {
            transferRecord.current = undefined;
            setPercent(0);
            setStatus("Connected. Ready to receive another file.");
          }}
        >
          Receive another file
        </button>
      )}
      {sharing && (
        <button className="secondary end-share" onClick={() => void endShare()}>
          End share
        </button>
      )}
      <details className="advanced">
        <summary>Advanced connection diagnostics</summary>
        {technicalPanel}
      </details>
    </section>
  );
}
