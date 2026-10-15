import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Zap, Shield, ArrowUpRight, Moon } from "lucide-react";
import { OnlinePanel } from "./online";
import { OpticalPanel } from "./optical";
import { ComingSoon } from "./coming-soon";
import { TransferHistory } from "./transfer-history";
import "./style.css";
import "./online-style.css";

function OnlineApp() {
  const [page, setPage] = useState(
    location.hash.includes("online-room") ? "Receive Files" : "Home",
  );
  const [started, setStarted] = useState(false);
  const [healthy, setHealthy] = useState(false);
  const [status, setStatus] = useState(
    "Connecting to signaling server… First connection may take a minute.",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (page === "Optical Share" || page === "Send Later — Coming Soon") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    setStatus(
      "Connecting to signaling server… First connection may take a minute.",
    );
    const base =
      (import.meta as unknown as { env: Record<string, string> }).env
        .VITE_SIGNAL_URL || "/signal";
    void (async () => {
      const url = new URL(base, location.href);
      if (
        !window.isSecureContext ||
        (url.protocol !== "https:" &&
          !(url.origin === location.origin && window.isSecureContext))
      )
        throw new Error("HTTPS is required for Online Sharing.");
      const response = await fetch(base + "/health", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "Signaling service is unavailable (" + response.status + ").",
        );
      const data = await response.json();
      if (data.service !== "signaling" || data.status !== "ok")
        throw new Error(
          "The configured endpoint is not a healthy FlowDrop signaling service.",
        );
      setHealthy(true);
      setStatus(
        data.turnConfigured
          ? "Signaling ready. TURN is configured; connectivity depends on your network."
          : "Signaling ready. Direct P2P first; no TURN relay is configured. Some networks cannot connect.",
      );
    })()
      .catch((e) => {
        if (!controller.signal.aborted || e.name === "AbortError")
          setStatus(
            "Unable to reach signaling. The service may be waking or restarting. Retry shortly. " +
              (e.name === "AbortError" ? "Connection timed out." : String(e)),
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    attempt,
    page === "Optical Share" || page === "Send Later — Coming Soon",
  ]);
  const choose = (value: string) => {
    setPage(value);
    if (["Send Files", "Receive Files", "Share Text"].includes(value))
      setStarted(true);
  };
  return (
    <div className="shell online-shell">
      <aside>
        <a className="brand" href="#" onClick={() => choose("Home")}>
          <Zap fill="currentColor" />
          FlowDrop<span>●</span>
        </a>
        <p className="caption">ONLINE · NO INSTALLATION</p>
        <nav aria-label="Online navigation">
          {[
            "Home",
            "Send Files",
            "Receive Files",
            "Share Text",
            "Optical Share",
            "Send Later — Coming Soon",
            "Transfer Progress",
            "Connection Diagnostics",
            "Privacy and Help",
          ].map((item) => (
            <button
              key={item}
              className={page === item ? "active" : ""}
              onClick={() => choose(item)}
            >
              {item}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </nav>
        <div className="privacy">
          <Shield />
          <b>No account required</b>
          <small>Your host PC is not a server for this website.</small>
        </div>
      </aside>
      <main>
        <header>
          <button onClick={() => choose("Privacy and Help")}>
            How it Works
          </button>
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
          <h1>{page === "Home" ? <>Share files instantly.</> : page}</h1>
          <p>No login. No installation. Just share.</p>
        </section>
        {page === "Home" && (
          <>
            <div className="cards">
              {[
                "Send Files",
                "Receive Files",
                "Optical Share",
                "Send Later — Coming Soon",
              ].map((item, i) => (
                <button
                  className="card"
                  key={item}
                  onClick={() => choose(item)}
                >
                  <ArrowUpRight />
                  <h2>
                    {item === "Send Files"
                      ? "Send"
                      : item === "Receive Files"
                        ? "Receive"
                        : item}
                  </h2>
                  <p>
                    {
                      [
                        "Create a temporary room and invite someone.",
                        "Open an invitation or join with a room code.",
                        "Screen-to-camera text and small files.",
                        "Future encrypted temporary sharing links.",
                      ][i]
                    }
                  </p>
                </button>
              ))}
            </div>
            <section className="panel">
              <h2>One room. Two browsers.</h2>
              <p>
                1. Create a room. 2. Share its link or QR. 3. Approve the
                receiver and accept each file.
              </p>
              <p>
                No account, installation or always-on personal PC. Keep both
                sharing tabs open.
              </p>
            </section>
          </>
        )}
        {page === "Optical Share" && <OpticalPanel />}
        {page === "Send Later — Coming Soon" && <ComingSoon />}
        <section
          hidden={
            page === "Optical Share" || page === "Send Later — Coming Soon"
          }
          className="online-health"
          aria-label="Signaling availability"
        >
          <p role="status">{status}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry signaling connection
          </button>
        </section>
        {(started || location.hash.includes("online-room")) && (
          <div
            hidden={
              !["Send Files", "Receive Files", "Share Text"].includes(page)
            }
          >
            {healthy && <OnlinePanel folders />}
          </div>
        )}
        {page === "Transfer Progress" && (
          <section className="panel">
            <h2>Your transfers in this tab</h2>
            <TransferHistory onMode={() => choose("Send Files")} />
          </section>
        )}
        {page === "Connection Diagnostics" && (
          <section className="panel">
            <h2>Connection diagnostics</h2>
            <p>
              Signaling reachability does not guarantee a peer connection. Open
              the sharing controls to see the selected Direct P2P or TURN route
              and detailed ICE errors.
            </p>
            <p>
              Without TURN, symmetric NATs, VPNs or restrictive firewalls may
              prevent sharing. Try a different trusted network. Relay-only
              requires an operator-provided authenticated TURN service.
            </p>
            <button onClick={() => choose("Send Files")}>
              Open connection controls
            </button>
          </section>
        )}
        {page === "Privacy and Help" && (
          <section className="panel">
            <h2>Private by design. Honest about the network.</h2>
            <p>
              Signaling exchanges connection metadata, IP candidates and
              temporary room authorization, never file contents. Files and text
              travel over encrypted WebRTC DataChannels directly or through an
              authenticated TURN relay.
            </p>
            <p>
              Only share invitations with people you trust. A room ID alone does
              not authorize a receiver. Both tabs must remain open; rooms expire
              after one hour and service restarts erase temporary rooms. Create
              a new room if reconnect reports expired or unavailable.
            </p>
            <p>
              Interrupted WebRTC files must be resent. Supported browsers stream
              downloads; others use a 128 MiB fallback. Folder selection sends
              files individually without preserving a directory tree. No
              universal network reachability is promised.
            </p>
            <p>
              End the room to revoke it. Transfer history and credentials stay
              in this tab; source recovery may use browser storage. Clear site
              data to remove retained source files.
            </p>
          </section>
        )}
        <footer>
          <Shield size={14} />
          Your files belong to you.<span>FLOWDROP ONLINE / 0.4.0</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<OnlineApp />);
