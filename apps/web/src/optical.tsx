import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  framesFor,
  fileFramesFor,
  OpticalCollector,
  type OpticalPayload,
} from "./optical-protocol";
export function OpticalPanel() {
  const [text, setText] = useState(""),
    [frames, setFrames] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [qr, setQr] = useState(""),
    [status, setStatus] = useState(
      "Text up to 16 KiB · small files up to 64 KiB",
    ),
    [speed, setSpeed] = useState(600),
    [file, setFile] = useState<File>(),
    [mode, setMode] = useState("text"),
    [payload, setPayload] = useState<OpticalPayload>(),
    [received, setReceived] = useState("");
  const generation = useRef(0);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    animation = useRef(0),
    collector = useRef(new OpticalCollector());
  useEffect(() => {
    if (paused || !frames.length) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      speed,
    );
    return () => clearInterval(timer);
  }, [frames, paused, speed]);
  useEffect(() => {
    if (frames[index])
      void QRCode.toDataURL(frames[index], {
        width: 420,
        errorCorrectionLevel: "M",
      }).then(setQr);
  }, [frames, index]);
  function stop() {
    generation.current++;
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
      const current = generation.current;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (current !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      async function tick() {
        if (!stream.current) return;
        const v = video.current!;
        if (current !== generation.current) return;
        if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
          canvas.width = Math.max(
            1,
            Math.round(
              v.videoWidth *
                Math.min(1, 1280 / v.videoWidth, 1280 / v.videoHeight),
            ),
          );
          canvas.height = Math.round(
            (v.videoHeight * canvas.width) / v.videoWidth,
          );
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
            frame = jsQR(image.data, image.width, image.height);
          if (frame) {
            try {
              const value = await collector.current.addPayload(frame.data),
                p = collector.current.progress;
              setStatus(
                `Received ${p.received} / ${p.total} frames · Missing ${p.missing.length} · Duplicates ${p.duplicates}`,
              );
              if (value !== undefined) {
                setPayload(value);
                setReceived(value.text || "");
                setStatus(
                  "Complete · SHA-256 verified; ready to copy or download",
                );
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
      stop();
      setStatus(String(e));
    }
  }
  return (
    <section className="panel">
      <h2>Optical Share</h2>
      <p>
        Move text or small files through a screen and camera. Once loaded, this
        mode needs no communication network. Keep the QR in view while frames
        repeat.
      </p>
      <p role="status">{status}</p>
      <label>
        Content type
        <select
          aria-label="Optical content type"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="text">Share Text</option>
          <option value="file">Share Small File</option>
        </select>
      </label>
      {mode === "file" && (
        <label>
          Small optical file (64 KiB maximum)
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
      )}
      {mode === "text" && (
        <textarea
          maxLength={16384}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Text to display as QR frames"
        />
      )}
      <button
        onClick={() =>
          void (
            mode === "text"
              ? framesFor(text)
              : file
                ? fileFramesFor(file)
                : Promise.reject(new Error("Select a small file first"))
          )
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
      <label>
        Frame speed (milliseconds)
        <input
          aria-label="Frame speed"
          type="range"
          min={200}
          max={2000}
          step={100}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
        {speed} ms
      </label>
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
          setPayload(undefined);
          setStatus("Receiver reset.");
        }}
      >
        Reset receiver
      </button>
      <label>
        Import QR frame image (camera-free fallback)
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const imageFile = event.target.files?.[0];
            if (!imageFile) return;
            try {
              if (imageFile.size > 5 * 1024 * 1024)
                throw new Error("QR image limit is 5 MiB");
              const bitmap = await createImageBitmap(imageFile);
              const canvas = document.createElement("canvas");
              canvas.width = Math.min(1280, bitmap.width);
              canvas.height = Math.round(
                (bitmap.height * canvas.width) / bitmap.width,
              );
              if (canvas.height > 2048 || !canvas.width || !canvas.height) {
                bitmap.close();
                throw new Error("Unsupported image dimensions");
              }
              const ctx = canvas.getContext("2d", {
                willReadFrequently: true,
              })!;
              ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              bitmap.close();
              const pixels = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                ),
                decoded = jsQR(pixels.data, pixels.width, pixels.height);
              if (!decoded) throw new Error("No readable QR frame found");
              const result = await collector.current.addPayload(decoded.data),
                progress = collector.current.progress;
              setStatus(
                `Received ${progress.received} / ${progress.total} frames · Missing ${progress.missing.length} · Duplicates ${progress.duplicates}`,
              );
              if (result) {
                setPayload(result);
                setReceived(result.text || "");
                setStatus(
                  "Complete · SHA-256 verified; ready to copy or download",
                );
                stop();
              }
            } catch (error) {
              setStatus(String(error));
            } finally {
              event.target.value = "";
            }
          }}
        />
      </label>
      <video ref={video} playsInline muted style={{ maxWidth: "100%" }} />
      {received && (
        <label>
          Received text — select to copy
          <textarea readOnly value={received} />
        </label>
      )}
      {payload && (
        <div>
          <p>
            {payload.name} · {payload.blob.size} bytes · {payload.kind}
          </p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(payload.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = payload.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
          >
            Download reconstructed {payload.kind === "file" ? "file" : "text"}
          </button>
          {payload.kind === "text" && (
            <button
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(received)
                  .catch(() =>
                    setStatus("Select the received text and copy manually."),
                  )
              }
            >
              Copy received text
            </button>
          )}
        </div>
      )}
      <p className="muted">
        Physical screen-to-camera testing is pending. Camera access needs a
        secure context; an HTTP LAN browser may not support it. Use imported QR
        screenshots, localhost on the host PC, or a trusted HTTPS deployment; do
        not bypass browser security. Smaller payloads and slower frames are more
        reliable. QR error correction and repeating frames tolerate missed
        scans; checksums cannot repair arbitrary lost frames. Optical checksums
        detect corruption, and do not authenticate the sender.
      </p>
    </section>
  );
}
