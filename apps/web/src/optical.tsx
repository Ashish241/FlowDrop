import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { framesFor, OpticalCollector } from "./optical-protocol";
export function OpticalPanel() {
  const [text, setText] = useState(""),
    [frames, setFrames] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [qr, setQr] = useState(""),
    [status, setStatus] = useState("Experimental · text only, up to 16 KiB"),
    [received, setReceived] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    animation = useRef(0),
    collector = useRef(new OpticalCollector());
  useEffect(() => {
    if (paused || !frames.length) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      600,
    );
    return () => clearInterval(timer);
  }, [frames, paused]);
  useEffect(() => {
    if (frames[index])
      void QRCode.toDataURL(frames[index], {
        width: 420,
        errorCorrectionLevel: "M",
      }).then(setQr);
  }, [frames, index]);
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    cancelAnimationFrame(animation.current);
  }
  useEffect(() => stop, []);
  async function scan() {
    try {
      stop();
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera requires HTTPS or localhost and browser support.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      async function tick() {
        if (!stream.current) return;
        const v = video.current!;
        if (v.readyState >= 2) {
          canvas.width = Math.min(1280, v.videoWidth);
          canvas.height = Math.round(
            (v.videoHeight * canvas.width) / v.videoWidth,
          );
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
            frame = jsQR(image.data, image.width, image.height);
          if (frame) {
            try {
              const value = await collector.current.add(frame.data),
                p = collector.current.progress;
              setStatus(`Received ${p.received} / ${p.total} frames`);
              if (value !== undefined) {
                setReceived(value);
                setStatus("Text complete · SHA-256 verified");
                stop();
                return;
              }
            } catch (e) {
              setStatus(String(e));
            }
          }
        }
        animation.current = requestAnimationFrame(() => void tick());
      }
      void tick();
    } catch (e) {
      setStatus(String(e));
    }
  }
  return (
    <section className="panel">
      <h2>Optical text · experimental</h2>
      <p>
        Move small text through a screen and camera. Once loaded, this mode
        needs no communication network. Keep the QR in view while frames repeat.
      </p>
      <p role="status">{status}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text to display as QR frames"
      />
      <button
        onClick={() =>
          void framesFor(text)
            .then((f) => {
              setFrames(f);
              setIndex(0);
              setPaused(false);
            })
            .catch((e) => setStatus(String(e)))
        }
      >
        Create frames
      </button>{" "}
      <button disabled={!frames.length} onClick={() => setPaused(!paused)}>
        {paused ? "Resume frames" : "Pause frames"}
      </button>{" "}
      <button disabled={!frames.length} onClick={() => setIndex(0)}>
        Restart frames
      </button>
      {qr && (
        <div>
          <img
            src={qr}
            alt={`Optical frame ${index + 1} of ${frames.length}`}
            style={{ maxWidth: "100%", width: 420 }}
          />
          <p>
            Frame {index + 1} / {frames.length}
          </p>
        </div>
      )}
      <h2>Receive with camera</h2>
      <button onClick={() => void scan()}>Start camera</button>{" "}
      <button onClick={stop}>Stop camera</button>{" "}
      <button
        onClick={() => {
          stop();
          collector.current = new OpticalCollector();
          setReceived("");
          setStatus("Receiver reset.");
        }}
      >
        Reset receiver
      </button>
      <video ref={video} playsInline muted style={{ maxWidth: "100%" }} />
      {received && (
        <label>
          Received text — select to copy
          <textarea readOnly value={received} />
        </label>
      )}
      <p className="muted">
        Physical screen-to-camera testing is pending. Camera access needs a
        secure context; an HTTP LAN browser may not support it. Optical
        checksums detect corruption, and do not authenticate the sender.
      </p>
    </section>
  );
}
