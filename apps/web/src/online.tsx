import { useEffect, useRef, useState } from "react";
import { createSHA256 } from "hash-wasm";
import { hashFile } from "./hash";
import { createStreamSink, type StreamSink } from "./stream-sink";
type Session = { room: string; token: string; member: string };
type Meta = {
  type: "file";
  id: string;
  name: string;
  size: number;
  sha256: string;
};
export function OnlinePanel() {
  const [room, setRoom] = useState(""),
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
  const peer = useRef<RTCPeerConnection | undefined>(undefined),
    socket = useRef<WebSocket | undefined>(undefined),
    channel = useRef<RTCDataChannel | undefined>(undefined),
    session = useRef<Session | undefined>(undefined),
    accept = useRef<(() => void) | undefined>(undefined),
    cancelled = useRef(false),
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
  useEffect(
    () => () => {
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
      method,
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!r.ok)
      throw new Error(
        "Signaling unavailable or room rejected (" +
          r.status +
          "). Check the signaling deployment.",
      );
    return r.json();
  }
  function close() {
    cancelled.current = true;
    accept.current?.();
    for (const waiter of creditWaiters.current.splice(0))
      waiter(new Error("Transfer cancelled"));
    sink.current?.abort();
    sink.current = undefined;
    channel.current?.close();
    peer.current?.close();
    socket.current?.close();
    incoming.current = undefined;
    setStatus("Disconnected");
    setRoute("Not connected");
  }
  function bind(dc: RTCDataChannel) {
    channel.current = dc;
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 262144;
    dc.onopen = () => setStatus("Connected. Files require receiver approval.");
    dc.onclose = () => {
      cancelled.current = true;
      accept.current?.();
      for (const waiter of creditWaiters.current.splice(0))
        waiter(new Error("Peer disconnected"));
      sink.current?.abort();
      sink.current = undefined;
      incoming.current = undefined;
      setOffer(undefined);
      setStatus("Peer disconnected; retry by reconnecting.");
    };
    dc.onmessage = (e) => {
      if (typeof e.data === "string") {
        if (e.data.length > 65536) {
          close();
          return;
        }
        try {
          const data = JSON.parse(e.data);
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
          if (typeof e.data === "string") {
            const data = JSON.parse(e.data);
            if (data.type === "file") {
              if (
                incoming.current ||
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
              hash.current = undefined;
              setOffer(data);
              setReceived(undefined);
            } else if (data.type === "accept") {
              accept.current?.();
            } else if (data.type === "reject" || data.type === "cancel") {
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
                setReceived({
                  name: meta.name,
                  blob,
                });
                setStatus("Completed · SHA-256 verified");
                dc.send(JSON.stringify({ type: "verified" }));
              }
              incoming.current = undefined;
              setOffer(undefined);
            } else if (data.type === "verified")
              setStatus("Delivered · receiver SHA-256 verified");
            else if (
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
                ? (offset.current / incoming.current.size) * 100
                : 100,
            );
          }
        })
        .finally(() => {
          queuedBytes.current -= queued;
        })
        .catch((e) => {
          close();
          setStatus("Transfer failed: " + String(e));
        });
    };
  }
  async function connect(join: boolean) {
    try {
      close();
      cancelled.current = false;
      setPending(false);
      setReceived(undefined);
      candidates.current = [];
      const data = (await api(
        join ? "/rooms/" + room.trim() + "/join" : "/rooms",
        "POST",
      )) as Session;
      session.current = data;
      setRoom(data.room);
      const ice = await api("/ice", "GET", data.token);
      const pc = new RTCPeerConnection(ice);
      peer.current = pc;
      const ws = new WebSocket(
        new URL(
          base + "/rooms/" + data.room + "/ws",
          location.href,
        ).href.replace(/^http/, "ws"),
      );
      socket.current = ws;
      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN)
          ws.send(
            JSON.stringify({ type: "ice", candidate: e.candidate.toJSON() }),
          );
      };
      pc.ondatachannel = (e) => bind(e.channel);
      pc.onconnectionstatechange = () => {
        setStatus(pc.connectionState);
        if (pc.connectionState === "connected")
          void pc.getStats().then((stats) => {
            for (const stat of stats.values()) {
              if (
                stat.type === "candidate-pair" &&
                stat.state === "succeeded"
              ) {
                const candidate = stats.get(stat.localCandidateId);
                setRoute(
                  candidate?.candidateType === "relay"
                    ? "TURN relay"
                    : "Direct P2P",
                );
              }
            }
          });
      };
      ws.onopen = () => {
        ws.send(data.token);
        setStatus(
          join
            ? "Waiting for owner approval"
            : "Room ready. Share the invitation code.",
        );
      };
      ws.onmessage = (e) => {
        void (async () => {
          const msg = JSON.parse(e.data);
          if (msg.type === "join-request") setPending(true);
          if (msg.type === "ready") {
            const dc = pc.createDataChannel("flowdrop", { ordered: true });
            bind(dc);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
          }
          if (msg.type === "offer") {
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
            if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
            else candidates.current.push(msg.candidate);
          }
        })().catch((e) => setStatus(String(e)));
      };
      ws.onerror = () =>
        setStatus(
          "Signaling connection failed. Check network, HTTPS, origin configuration, and TURN availability.",
        );
    } catch (e) {
      setStatus(String(e));
    }
  }
  async function send(file?: File) {
    if (!file) return;
    if (sending.current) {
      setStatus("Another file is still in progress.");
      return;
    }
    sending.current = true;
    acked.current = 0;
    sent.current = 0;
    function waitForCredit() {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
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
      if (!dc || dc.readyState !== "open")
        throw new Error("Connect to a peer first.");
      if (file.size > 20 * 1024 ** 3)
        throw new Error("Current online limit is 20 GiB.");
      cancelled.current = false;
      const digest = await hashFile(file);
      setStatus("Waiting for receiver approval");
      await new Promise<void>((resolve) => {
        accept.current = resolve;
        dc.send(
          JSON.stringify({
            type: "file",
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            sha256: digest,
          }),
        );
      });
      if (cancelled.current) return;
      setStatus("Transferring file with receiver acknowledgements");
      for (let start = 0; start < file.size; start += 65536) {
        if (cancelled.current) break;
        while (
          start + Math.min(65536, file.size - start) - acked.current >
          1048576
        )
          await waitForCredit();
        while (dc.bufferedAmount > 1048576) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Peer stopped receiving")),
              30000,
            );
            dc.addEventListener(
              "bufferedamountlow",
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true },
            );
          });
        }
        dc.send(await file.slice(start, start + 65536).arrayBuffer());
        sent.current = Math.min(file.size, start + 65536);
        setPercent(Math.min(100, ((start + 65536) / file.size) * 100));
      }
      if (!cancelled.current) {
        while (acked.current < file.size) await waitForCredit();
        dc.send(JSON.stringify({ type: "finish" }));
        setStatus("Sent; receiver verifies the hash.");
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      sending.current = false;
    }
  }
  return (
    <section className="panel">
      <h2>Online peer-to-peer</h2>
      <p>
        Use the hosted signaling service. File bytes travel over an encrypted
        WebRTC DataChannel.
      </p>
      <label>
        Room invitation
        <input value={room} onChange={(e) => setRoom(e.target.value)} />
      </label>
      <button onClick={() => void connect(false)}>Create room</button>{" "}
      <button onClick={() => void connect(true)}>Join room</button>{" "}
      <button onClick={close}>Disconnect</button>
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
            cancelled.current = false;
            for (const file of Array.from(e.target.files || [])) {
              if (cancelled.current) break;
              await send(file);
            }
          }}
        />
      </label>
      <progress max={100} value={percent} />
      {offer && (
        <p>
          {offer.name} · {offer.size} bytes{" "}
          <button
            onClick={async () => {
              hash.current = await createSHA256();
              hash.current.init();
              offset.current = 0;
              try {
                sink.current = await createStreamSink(offer.name, offer.size);
              } catch (e) {
                setStatus(String(e));
                channel.current?.send(JSON.stringify({ type: "reject" }));
                incoming.current = undefined;
                setOffer(undefined);
                return;
              }
              channel.current?.send(JSON.stringify({ type: "accept" }));
              setStatus("Receiving and verifying file");
              setOffer(undefined);
            }}
          >
            Accept file
          </button>{" "}
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
      <button
        onClick={() => {
          cancelled.current = true;
          accept.current?.();
          channel.current?.send(JSON.stringify({ type: "cancel" }));
        }}
      >
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
        onClick={() => {
          if (channel.current?.readyState === "open") {
            channel.current.send(JSON.stringify({ type: "text", text }));
            setText("");
          } else setStatus("Connect first.");
        }}
      >
        Send text
      </button>
      {messages.map((message, index) => (
        <pre key={index}>{message}</pre>
      ))}
      <p className="muted">
        Direct connections depend on network conditions. TURN is configured by
        the operator. Secure browsers stream downloads with a 1 MiB
        acknowledgement window. Browsers without Service Worker support use a
        128 MiB fallback. Interrupted online transfers require resending.
      </p>
    </section>
  );
}
