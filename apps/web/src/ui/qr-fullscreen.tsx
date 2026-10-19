import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";
import "./qr-fullscreen.css";

/** Keep the QR mounted while native fullscreen or the in-page fallback changes. */
export function QRFrameViewer({ children }: { children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const sync = () =>
      setNative(document.fullscreenElement === element.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    const focused = document.activeElement;
    document.body.style.overflow = "hidden";
    const button = element.current?.querySelector<HTMLButtonElement>("button");
    button?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        button?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", trap);
      if (focused instanceof HTMLElement && focused.isConnected)
        focused.focus();
    };
  }, [expanded]);
  const active = native || expanded;
  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (document.fullscreenElement === element.current) {
        await document.exitFullscreen();
      } else if (expanded) {
        setExpanded(false);
      } else {
        try {
          if (!element.current?.requestFullscreen) throw Error("Unsupported");
          await element.current.requestFullscreen();
        } catch {
          setExpanded(true);
        }
      }
    } finally {
      busy.current = false;
    }
  }
  return (
    <div
      ref={element}
      className={`optical-screen${expanded ? " qr-expanded" : ""}`}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? "Expanded optical QR" : undefined}
    >
      {children}
      <button
        className="qr-fullscreen-toggle"
        onClick={() => void toggle()}
        aria-pressed={active}
      >
        {active ? (
          <Minimize size={18} aria-hidden="true" />
        ) : (
          <Maximize size={18} aria-hidden="true" />
        )}
        {active ? "Exit Fullscreen" : "Fullscreen QR"}
      </button>
    </div>
  );
}
