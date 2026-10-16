import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { type OpticalPayload } from "./optical-protocol";
import {
  buildOpticalTransfer,
  ReliableOpticalCollector,
  recoveryFrames,
  parseRecovery,
  selectiveFrames,
  manualMissing,
  opticalCaptureSize,
  type OpticalTransfer,
  type RecoveryRequest,
} from "./optical-reliable";
import { formatSize } from "./room-utils";
import { hashFile } from "./hash";
type Diagnostics = {
  attempts: number;
  decoded: number;
  noQr: number;
  errors: number;
  decodeMs: number;
  elapsed: number;
  source: "camera" | "import";
};
const initialDiag = (): Diagnostics => ({
  attempts: 0,
  decoded: 0,
  noQr: 0,
  errors: 0,
  decodeMs: 0,
  elapsed: 0,
  source: "import",
});
export function OpticalPanel() {
  const [text, setText] = useState(""),
    [mode, setMode] = useState("text"),
    [file, setFile] = useState<File>(),
    [transfer, setTransfer] = useState<OpticalTransfer>(),
    [frames, setFrames] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [qr, setQr] = useState(""),
    [renderedIndex, setRenderedIndex] = useState(0),
    [speed, setSpeed] = useState(1000),
    [preset, setPreset] = useState("Auto"),
    [size, setSize] = useState(600),
    [chunk, setChunk] = useState(400),
    [parity, setParity] = useState(2),
    [compress, setCompress] = useState(true),
    [building, setBuilding] = useState(false),
    [status, setStatus] = useState(
      "Ready · Text up to 16 KiB · small files up to 64 KiB",
    ),
    [payload, setPayload] = useState<OpticalPayload>(),
    [revision, setRevision] = useState(0),
    [manual, setManual] = useState(""),
    [requests, setRequests] = useState<string[]>([]),
    [requestIndex, setRequestIndex] = useState(0),
    [requestQr, setRequestQr] = useState(""),
    [cameraSize, setCameraSize] = useState(1280),
    [decoderReady, setDecoderReady] = useState(false),
    [scanning, setScanning] = useState(false),
    [diag, setDiag] = useState(initialDiag),
    [displayed, setDisplayed] = useState({
      count: 0,
      holdMs: 0,
      qrMs: 0,
      version: 0,
    });
  const collector = useRef(new ReliableOpticalCollector()),
    video = useRef<HTMLVideoElement>(null),
    screen = useRef<HTMLDivElement>(null),
    stream = useRef<MediaStream | undefined>(undefined),
    worker = useRef<Worker | undefined>(undefined),
    cameraGeneration = useRef(0),
    sequence = useRef(0),
    pending = useRef<
      | {
          sequence: number;
          purpose: "receive" | "feedback";
          epoch: number;
          image?: boolean;
        }
      | undefined
    >(undefined),
    animation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    shown = useRef(0),
    loadedQr = useRef(""),
    diagnostics = useRef(initialDiag()),
    started = useRef(0),
    feedback = useRef(new Map<number, RecoveryRequest>()),
    transferRef = useRef(transfer),
    presetRef = useRef(preset),
    scanPurpose = useRef<"receive" | "feedback">("receive"),
    processing = useRef(Promise.resolve());
  transferRef.current = transfer;
  presetRef.current = preset;
  const progress = collector.current.progress;
  function stop() {
    cameraGeneration.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    cancelAnimationFrame(animation.current);
    pending.current = undefined;
    setScanning(false);
  }
  function showProgress() {
    const p = collector.current.progress;
    setRevision((v) => v + 1);
    setStatus(
      `${p.missing.length ? "Incomplete · Receiving" : "Verifying"} · Received ${p.received} / ${p.total} frames · Missing ${p.missing.length} · Duplicates ${p.duplicates} · Recovered ${p.recovered}`,
    );
  }
  function receive(raw: string, purpose: "receive" | "feedback") {
    const target = collector.current;
    processing.current = processing.current.then(async () => {
      try {
        if (purpose === "feedback") {
          const request = parseRecovery(raw),
            current = transferRef.current;
          if (
            !current ||
            request.id !== current.meta.id ||
            request.count !== current.meta.count
          )
            throw Error("Recovery request is for a different transfer.");
          feedback.current.set(request.part, request);
          if (feedback.current.size < request.parts) {
            setStatus(
              `Recovering · Scan recovery QR ${feedback.current.size} / ${request.parts}`,
            );
            return;
          }
          const selected = selectiveFrames(current, [
            ...feedback.current.values(),
          ]);
          setFrames(selected);
          setIndex(0);
          setPaused(false);
          if (presetRef.current === "Auto")
            setSpeed(
              request.rate < 1 || selected.length / current.meta.count > 0.2
                ? 1400
                : request.rate > 3
                  ? 800
                  : 1000,
            );
          setStatus(
            `Recovering · Sending only ${selected.length} requested data frames. Auto uses this explicit receiver feedback only.`,
          );
          stop();
          return;
        }
        const receiver = target;
        if (receiver !== collector.current) return;
        setStatus("Verifying frame…");
        const value = await receiver.addPayload(raw);
        if (receiver !== collector.current) return;
        showProgress();
        if (value) {
          setPayload(value);
          setRequests([]);
          setStatus("Completed · SHA-256 verified; ready to copy or download");
          stop();
        }
      } catch (error) {
        setRevision((v) => v + 1);
        setStatus(
          `Failed frame · ${String(error)} Existing received data is retained.`,
        );
      }
    });
    return processing.current;
  }
  useEffect(() => {
    const decoder = new Worker(
      new URL("./optical-decoder.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = decoder;
    decoder.onmessage = (
      event: MessageEvent<{
        ready?: boolean;
        sequence: number;
        raw?: string;
        ms: number;
        error?: string;
      }>,
    ) => {
      if (event.data.ready) {
        setDecoderReady(true);
        return;
      }
      const job = pending.current;
      if (!job || event.data.sequence !== job.sequence) return;
      pending.current = undefined;
      if (job.epoch !== cameraGeneration.current) return;
      const d = diagnostics.current;
      d.attempts++;
      d.decodeMs += event.data.ms;
      d.elapsed = (performance.now() - started.current) / 1000;
      if (event.data.raw) {
        d.decoded++;
        void receive(event.data.raw, job.purpose);
      } else if (event.data.error) {
        d.errors++;
        setStatus(event.data.error);
      } else {
        d.noQr++;
        if (job.image)
          setStatus(
            "Incomplete · No readable QR in this image. Enlarge it, keep the white border, and try again.",
          );
      }
      setDiag({ ...d });
    };
    decoder.onerror = () => {
      setStatus(
        "Failed · QR decoder could not start. Reload Optical Share while connected before going offline.",
      );
      setDecoderReady(false);
      stop();
    };
    return () => {
      cameraGeneration.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animation.current);
      clearTimeout(timer.current);
      decoder.terminate();
    };
  }, []);
  useEffect(() => {
    let live = true;
    clearTimeout(timer.current);
    if (!frames[index]) {
      setQr("");
      return;
    }
    loadedQr.current = "";
    const start = performance.now();
    const code = QRCode.create(frames[index], { errorCorrectionLevel: "M" });
    void QRCode.toDataURL(frames[index], {
      width: size,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#000000ff", light: "#ffffffff" },
    })
      .then((value) => {
        if (live) {
          setQr(value);
          setRenderedIndex(index);
          setDisplayed((previous) => ({
            ...previous,
            qrMs: performance.now() - start,
            version: code.version,
          }));
        }
      })
      .catch((error) => {
        if (live) setStatus(`Failed · ${String(error)}`);
      });
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, [frames, index, size]);
  function schedule() {
    clearTimeout(timer.current);
    loadedQr.current = qr;
    const stamp = performance.now();
    setDisplayed((previous) => ({
      ...previous,
      count: previous.count + 1,
      holdMs: shown.current ? stamp - shown.current : 0,
    }));
    shown.current = stamp;
    if (!paused && frames.length > 1)
      timer.current = setTimeout(
        () => setIndex((i) => (i + 1) % frames.length),
        speed,
      );
  }
  useEffect(() => {
    clearTimeout(timer.current);
    if (!paused && frames.length > 1 && qr && loadedQr.current === qr)
      timer.current = setTimeout(
        () => setIndex((i) => (i + 1) % frames.length),
        speed,
      );
    return () => clearTimeout(timer.current);
  }, [paused, speed, frames.length, qr]);
  useEffect(() => {
    let live = true;
    if (requests[requestIndex])
      void QRCode.toDataURL(requests[requestIndex], {
        width: 600,
        margin: 4,
        errorCorrectionLevel: "M",
      }).then((value) => {
        if (live) setRequestQr(value);
      });
    else setRequestQr("");
    return () => {
      live = false;
    };
  }, [requests, requestIndex]);
  async function create() {
    setBuilding(true);
    try {
      const result = await buildOpticalTransfer(
        mode === "text"
          ? new Blob([text])
          : file ||
              (() => {
                throw Error("Select a small file first");
              })(),
        mode === "text" ? "optical.txt" : file!.name,
        mode === "text" ? "text" : "file",
        { chunkSize: chunk, parity, compress },
      );
      setTransfer(result);
      feedback.current.clear();
      // Interleave blocks: a short burst is spread across erasure groups rather than one group.
      const order: number[] = [];
      for (let slot = 0; slot < 8 + result.meta.parity; slot++)
        for (let block = 0; block < Math.ceil(result.meta.count / 8); block++) {
          const data = Math.min(8, result.meta.count - block * 8);
          if (slot < data) order.push(block * 8 + slot);
          else if (slot >= 8 && slot < 8 + result.meta.parity)
            order.push(
              result.meta.count + block * result.meta.parity + slot - 8,
            );
        }
      setFrames(order.map((i) => result.frames[i]));
      setIndex(0);
      setPaused(false);
      setStatus(
        `Ready · Sending ${result.frames.length} frames; receipt is confirmed only by the receiver.`,
      );
    } catch (error) {
      setStatus(`Failed · ${String(error)}`);
    } finally {
      setBuilding(false);
    }
  }
  async function scan(purpose: "receive" | "feedback" = "receive") {
    stop();
    try {
      if (!decoderReady)
        throw Error("QR decoder is loading. Wait for Decoder ready.");
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera requires HTTPS or localhost and browser support. Use imported images or manual recovery.",
        );
      const epoch = cameraGeneration.current;
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: cameraSize },
          height: { ideal: (cameraSize * 9) / 16 },
        },
        audio: false,
      });
      if (epoch !== cameraGeneration.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      scanPurpose.current = purpose;
      setScanning(true);
      setStatus(
        purpose === "feedback"
          ? "Recovering · Scan every receiver recovery QR page."
          : "Scanning · Hold the full QR and its white border steady.",
      );
      started.current = performance.now();
      diagnostics.current = initialDiag();
      diagnostics.current.source = "camera";
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let captured = 0;
      function tick() {
        if (epoch !== cameraGeneration.current || !stream.current) return;
        const v = video.current!,
          now = performance.now();
        if (
          !pending.current &&
          v.readyState >= 2 &&
          v.videoWidth &&
          v.videoHeight &&
          now - captured >= 120
        ) {
          captured = now;
          const dimensions = opticalCaptureSize(
            v.videoWidth,
            v.videoHeight,
            cameraSize,
          );
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
            seq = ++sequence.current;
          pending.current = { sequence: seq, purpose, epoch };
          worker.current!.postMessage(
            {
              pixels: pixels.data.buffer,
              width: canvas.width,
              height: canvas.height,
              sequence: seq,
            },
            [pixels.data.buffer],
          );
        }
        animation.current = requestAnimationFrame(tick);
      }
      tick();
    } catch (error) {
      stop();
      setStatus(
        `Failed · ${String(error)}. Camera permission denied? Allow it in browser settings or use imported QR images/manual recovery.`,
      );
    }
  }
  async function importImage(imageFile: File, purpose: "receive" | "feedback") {
    if (!stream.current) diagnostics.current.source = "import";
    try {
      if (!decoderReady) throw Error("Wait for Decoder ready");
      if (pending.current) throw Error("Decoder busy; try this image again");
      if (imageFile.size > 5 * 1024 * 1024)
        throw Error("QR image limit is 5 MiB");
      const bitmap = await createImageBitmap(imageFile);
      const scale = Math.min(1, 1280 / bitmap.width, 1280 / bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
        seq = ++sequence.current;
      if (!started.current) started.current = performance.now();
      pending.current = {
        sequence: seq,
        purpose,
        epoch: cameraGeneration.current,
        image: true,
      };
      worker.current!.postMessage(
        {
          pixels: pixels.data.buffer,
          width: canvas.width,
          height: canvas.height,
          sequence: seq,
        },
        [pixels.data.buffer],
      );
    } catch (error) {
      setStatus(`Failed · ${String(error)}`);
    }
  }
  const rawCount = Math.max(
    1,
    Math.ceil(
      (mode === "file"
        ? file?.size || 0
        : new TextEncoder().encode(text).length) / chunk,
    ),
  );
  const estimateCount =
    transfer?.frames.length ??
    rawCount + (rawCount > 1 ? Math.ceil(rawCount / 8) * parity : 0);
  return (
    <section
      className="panel optical-panel"
      data-revision={revision}
      data-optical-received={progress.received}
      data-optical-total={progress.total}
      data-optical-decoded={diag.decoded}
    >
      <h2>Optical Share</h2>
      <p>
        Screen to camera, with no communication network after this page and
        Decoder ready have loaded. Text up to 16 KiB · files up to 64 KiB.
      </p>
      <p role="status">{status}</p>
      <p className="muted">
        {decoderReady
          ? "Decoder ready · processing runs in a Web Worker"
          : "Loading offline QR decoder…"}
      </p>
      <div className="optical-columns">
        <section aria-label="Optical sender">
          <h3>1 · Send text or a small file</h3>
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
          {mode === "text" ? (
            <textarea
              aria-label="Optical text"
              maxLength={16384}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Text to display as QR frames"
            />
          ) : (
            <label>
              Small optical file (64 KiB maximum)
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
          )}
          {file && mode === "file" && (
            <p>
              {file.name} · {formatSize(file.size)}
            </p>
          )}
          <div className="optical-options">
            <label>
              Playback preset
              <select
                value={preset}
                onChange={(event) => {
                  const value = event.target.value;
                  setPreset(value);
                  if (value === "Auto") setChunk(400);
                  setSpeed(
                    value === "Slow" ? 1400 : value === "Fast" ? 600 : 1000,
                  );
                }}
              >
                {["Auto", "Slow", "Normal", "Fast", "Custom"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Payload bytes per frame
              <select
                value={chunk}
                onChange={(event) => {
                  setChunk(Number(event.target.value));
                  setPreset("Custom");
                }}
              >
                {[200, 400, 600, 800].map((value) => (
                  <option key={value} value={value}>
                    {value}
                    {value === 400 ? " · conservative default" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parity per 8 data frames
              <select
                value={parity}
                onChange={(event) => setParity(Number(event.target.value))}
              >
                {[0, 1, 2, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={compress}
                onChange={(event) => setCompress(event.target.checked)}
              />
              Compress only when smaller
            </label>
            <label>
              QR size
              <select
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              >
                {[420, 600, 800, 1000].map((value) => (
                  <option key={value} value={value}>
                    {value} px
                  </option>
                ))}
              </select>
            </label>
            <label>
              Frame speed (milliseconds)
              <input
                aria-label="Frame speed"
                type="range"
                min={400}
                max={2000}
                step={100}
                value={speed}
                onChange={(event) => {
                  setSpeed(Number(event.target.value));
                  setPreset("Custom");
                }}
              />
              {speed} ms
            </label>
          </div>
          <p>
            {transfer ? "Prepared" : "Estimated before compression"}:{" "}
            {estimateCount} frames · estimated one-cycle time{" "}
            {Math.ceil((estimateCount * speed) / 1000)} seconds. Missing scans
            may require recovery; this is not a delivery guarantee.
          </p>
          <p className="muted">
            Auto starts at 400 bytes / 1000 ms and adjusts dwell only after an
            explicit receiver recovery QR. A one-way camera cannot provide
            automatic feedback.
          </p>
          <div className="flow-actions">
            <button disabled={building} onClick={() => void create()}>
              {building ? "Preparing…" : "Start Transfer"}
            </button>
            <button
              disabled={!frames.length}
              onClick={() => setPaused(!paused)}
            >
              {paused ? "Resume frames" : "Pause frames"}
            </button>
            <button
              disabled={!frames.length}
              onClick={() => {
                setPaused(true);
                setIndex((i) => (i + 1) % frames.length);
              }}
            >
              Next frame
            </button>
            <button
              disabled={!frames.length}
              onClick={() => {
                setIndex(0);
                setPaused(false);
              }}
            >
              Restart frames
            </button>
          </div>
          {qr && (
            <div ref={screen} className="optical-screen">
              <img
                src={qr}
                onLoad={schedule}
                alt={`Optical frame ${renderedIndex + 1} of ${frames.length}`}
                style={{ width: size, maxWidth: "100%" }}
              />
              <p>
                Frame {renderedIndex + 1} / {frames.length} ·{" "}
                {paused ? "Paused" : "Repeating"}
              </p>
              <button
                onClick={() => {
                  if (!screen.current?.requestFullscreen) {
                    setStatus(
                      "Fullscreen unavailable; enlarge the QR using QR size.",
                    );
                    return;
                  }
                  void screen.current
                    .requestFullscreen()
                    .catch(() =>
                      setStatus(
                        "Fullscreen unavailable; enlarge the QR using QR size.",
                      ),
                    );
                }}
              >
                Fullscreen QR
              </button>
            </div>
          )}
          <details>
            <summary>Sender measurements</summary>
            <p>
              QR version {displayed.version} · M correction · 4-module quiet
              zone · {frames[index]?.length || 0} encoded characters · QR
              generation {displayed.qrMs.toFixed(1)} ms · last observed display
              interval {displayed.holdMs.toFixed(0)} ms · {displayed.count}{" "}
              image loads.
            </p>
            {transfer && (
              <p>
                Original {transfer.meta.size} B · encoded{" "}
                {transfer.meta.encodedSize} B · {transfer.meta.count} data +{" "}
                {transfer.frames.length - transfer.meta.count} parity frames ·
                preparation {transfer.generationMs.toFixed(1)} ms. FEC recovers
                at most {transfer.meta.parity} missing frames per group when
                enough other group frames arrive.
              </p>
            )}
          </details>
          <details>
            <summary>Recovery Mode · send only missing frames</summary>
            <p>
              On the receiver choose Recover Missing Frames, then point this
              device at each recovery QR page. Or type the receiver’s one-based
              missing numbers.
            </p>
            <button
              disabled={!transfer || !decoderReady}
              onClick={() => {
                feedback.current.clear();
                void scan("feedback");
              }}
            >
              Scan recovery QR
            </button>
            <label>
              Import recovery QR image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void importImage(selected, "feedback");
                  event.target.value = "";
                }}
              />
            </label>
            <label>
              Missing frame numbers to resend
              <input
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                placeholder="1,4-8,27"
              />
            </label>
            <button
              disabled={!transfer}
              onClick={() => {
                try {
                  const selected = manualMissing(manual, transfer!.meta.count);
                  setFrames(selected.map((i) => transfer!.frames[i]));
                  setIndex(0);
                  setPaused(false);
                  setStatus(
                    `Recovering · Sending only ${selected.length} requested data frames.`,
                  );
                } catch (error) {
                  setStatus(String(error));
                }
              }}
            >
              Send requested frames
            </button>
          </details>
        </section>
        <section aria-label="Optical receiver">
          <h3>2 · Receive and verify</h3>
          <p>
            Keep the whole white border visible. Avoid reflections, tap the
            camera preview to focus if supported, and reduce screen brightness
            if the code blooms. Start with Normal/Slow and 400-byte frames.
          </p>
          <label>
            Camera resolution
            <select
              value={cameraSize}
              onChange={(event) => setCameraSize(Number(event.target.value))}
            >
              <option value={720}>720 px · lower decoding cost</option>
              <option value={1280}>1280 px · recommended</option>
            </select>
          </label>
          <div className="flow-actions">
            <button disabled={!decoderReady} onClick={() => void scan()}>
              Start camera
            </button>
            <button onClick={stop}>Stop camera</button>
            <button
              onClick={() => {
                stop();
                collector.current = new ReliableOpticalCollector();
                setPayload(undefined);
                setRequests([]);
                setRevision((v) => v + 1);
                setStatus("Ready · Receiver reset.");
              }}
            >
              Reset receiver
            </button>
          </div>
          <video
            ref={video}
            playsInline
            muted
            hidden={!scanning}
            style={{ maxWidth: "100%" }}
          />
          <label>
            Import QR frame image (camera-free fallback)
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void importImage(selected, "receive");
                event.target.value = "";
              }}
            />
          </label>
          <p>
            Received {progress.received} / {progress.total} · Missing{" "}
            {progress.missing.length} · {progress.percent.toFixed(1)}% ·
            Recovered {progress.recovered}
          </p>
          <progress
            aria-label="Optical receive progress"
            max={100}
            value={payload ? 100 : Math.min(99.9, progress.percent)}
          />
          {progress.total > 0 && !payload && (
            <label>
              Missing frame numbers
              <textarea
                readOnly
                aria-label="Missing frame numbers"
                value={progress.missing.map((i) => i + 1).join(",")}
              />
            </label>
          )}
          <button
            disabled={!progress.id || !progress.missing.length}
            onClick={() => {
              try {
                setRequests(
                  recoveryFrames(
                    progress,
                    diag.source === "camera" && diag.elapsed
                      ? diag.decoded / diag.elapsed
                      : 0,
                  ),
                );
                setRequestIndex(0);
                setStatus(
                  `Recovering · Missing ${progress.missing.length}. Show each recovery QR to the sender; existing data is kept.`,
                );
              } catch (error) {
                setStatus(String(error));
              }
            }}
          >
            Recover Missing Frames
          </button>
          {requestQr && (
            <div>
              <img
                src={requestQr}
                alt={`Recovery request ${requestIndex + 1} of ${requests.length}`}
                style={{ width: 600, maxWidth: "100%" }}
              />
              <p>
                Recovery QR {requestIndex + 1} / {requests.length}
              </p>
              <button
                onClick={() =>
                  setRequestIndex((i) => (i + 1) % requests.length)
                }
              >
                Next recovery QR
              </button>
            </div>
          )}
          {payload && (
            <div>
              <p>
                {payload.name} · {formatSize(payload.blob.size)} · SHA-256
                verified
              </p>
              {payload.kind === "text" && (
                <label>
                  Received text — select to copy
                  <textarea
                    aria-label="Received text — select to copy"
                    readOnly
                    value={payload.text}
                  />
                </label>
              )}
              <button
                onClick={() => {
                  const url = URL.createObjectURL(payload.blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = payload.name;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }}
              >
                Download reconstructed{" "}
                {payload.kind === "file" ? "file" : "text"}
              </button>
              <button
                onClick={() => {
                  setStatus("Verifying file SHA-256…");
                  void hashFile(payload.blob)
                    .then((hash) => {
                      if (hash === payload.sha256)
                        setStatus("Completed · SHA-256 verified again");
                      else {
                        setPayload(undefined);
                        setStatus(
                          "Failed · Optical checksum mismatch; download disabled.",
                        );
                      }
                    })
                    .catch(() =>
                      setStatus("Failed · Could not verify this payload."),
                    );
                }}
              >
                Verify File
              </button>
              {payload.kind === "text" && (
                <button
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(payload.text || "")
                      .catch(() =>
                        setStatus("Select received text and copy manually."),
                      )
                  }
                >
                  Copy received text
                </button>
              )}
            </div>
          )}
          <details>
            <summary>Receiver diagnostics · no file contents</summary>
            <p>
              Attempts {diag.attempts} · decoded {diag.decoded} · no QR{" "}
              {diag.noQr} · decoder errors {diag.errors} · invalid frames{" "}
              {progress.invalid} · mixed transfers {progress.mixed} · duplicates{" "}
              {progress.duplicates} · FEC recovered {progress.recovered} ·
              stored payload {progress.storedBytes} B.
            </p>
            <p>
              Mean decode{" "}
              {diag.attempts ? (diag.decodeMs / diag.attempts).toFixed(1) : 0}{" "}
              ms · observed{" "}
              {diag.elapsed ? (diag.decoded / diag.elapsed).toFixed(2) : 0}{" "}
              decodes/s. Actual camera captures and image imports are measured;
              generated frames are not counted as received.
            </p>
          </details>
          <p className="muted">
            Integrity checks detect corruption; they do not authenticate a
            sender. No success is shown until final SHA-256 matches.
            Phone-camera reliability must be checked on your physical devices;
            image tests are not physical verification. Stop/restart scanning
            retains received chunks; Reset starts a new transfer.
          </p>
        </section>
      </div>
    </section>
  );
}
