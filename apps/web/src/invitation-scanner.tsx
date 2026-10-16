import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { invitationCode } from "./room-utils";
export function InvitationScanner({
  onCode,
}: {
  onCode: (code: string) => void;
}) {
  const [scanning, setScanning] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | undefined>(undefined),
    frame = useRef(0),
    generation = useRef(0),
    detected = useRef(false);
  function stop() {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    setScanning(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function scan() {
    stop();
    setError("");
    detected.current = false;
    setScanning(true);
    const current = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera scanning requires HTTPS and a supported browser. Enter the room code instead.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (generation.current !== current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let previous = "";
      function tick() {
        if (
          current !== generation.current ||
          !stream.current ||
          detected.current
        )
          return;
        const v = video.current!;
        if (v.readyState >= 2) {
          const scale = Math.min(1, 720 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(pixels.data, pixels.width, pixels.height);
          if (result && result.data !== previous) {
            previous = result.data;
            try {
              const code = invitationCode(result.data);
              detected.current = true;
              stop();
              onCode(code);
              return;
            } catch (reason) {
              setError(String(reason));
            }
          }
        }
        frame.current = requestAnimationFrame(tick);
      }
      tick();
    } catch (reason) {
      if (current === generation.current) {
        stop();
        setError(
          reason instanceof DOMException && reason.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access or enter the room code."
            : String(reason),
        );
      }
    }
  }
  return (
    <div className="invitation-scanner">
      <button
        type="button"
        className="secondary"
        onClick={() => (scanning ? stop() : void scan())}
      >
        {scanning ? "Stop scanning" : "Scan QR"}
      </button>
      <video
        ref={video}
        hidden={!scanning}
        playsInline
        muted
        aria-label="Invitation camera"
      />
      {error && <p role="alert">{error}</p>}
      <small>Scan a FlowDrop room QR, or enter its code manually.</small>
    </div>
  );
}
