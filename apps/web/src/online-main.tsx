import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Zap, Moon, ArrowUpRight } from "lucide-react";
import { RoomDashboard } from "./room-dashboard";
import { OpticalPanel } from "./optical";
import "./style.css";
import "./online-style.css";
function OnlineApp() {
  const [page, setPage] = useState(
    location.hash.includes("room=")
      ? "Join Room"
      : sessionStorage.getItem("flowdrop-room-v2")
        ? "Create Room"
        : "Home",
  );
  const [started, setStarted] = useState(
    location.hash.includes("room=") ||
      !!sessionStorage.getItem("flowdrop-room-v2"),
  );
  const sharing = ["Create Room", "Join Room"].includes(page);
  function choose(next: string) {
    setPage(next);
    if (["Create Room", "Join Room"].includes(next)) setStarted(true);
  }
  return (
    <div className="online-app">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => choose("Home")}
          aria-label="FlowDrop home"
        >
          <Zap fill="currentColor" />
          FlowDrop
        </button>
        <div>
          <button className="quiet" onClick={() => choose("How It Works")}>
            How It Works
          </button>
          <button
            className="quiet"
            aria-label="Toggle theme"
            onClick={() => document.body.classList.toggle("dark")}
          >
            <Moon size={20} />
          </button>
        </div>
      </header>
      <main className="online-main">
        {page !== "Home" && (
          <button className="back-link" onClick={() => choose("Home")}>
            ← Home
          </button>
        )}
        <section className="intro">
          <p className="eyebrow">LESS FRICTION. MORE FLOW.</p>
          <h1>
            {page === "Home"
              ? "Share files instantly."
              : page === "Send Later — Coming Soon"
                ? "Send Later"
                : page}
          </h1>
          <p>
            {page === "Home"
              ? "No login. No installation. Just share."
              : sharing
                ? "A little closer, wherever you are."
                : ""}
          </p>
        </section>
        {page === "Home" && (
          <div className="home-actions">
            {["Create Room", "Join Room"].map((name, i) => (
              <button
                key={name}
                aria-label={name}
                className={i ? "primary-action receive" : "primary-action"}
                onClick={() => choose(name)}
              >
                <ArrowUpRight />
                <span>{name}</span>
                <small>
                  {i
                    ? "Join with a sharing code"
                    : "Start a private sharing room"}
                </small>
              </button>
            ))}
          </div>
        )}
        <nav className="simple-nav" aria-label="Online navigation">
          {[
            "Create Room",
            "Join Room",
            "Optical Share",
            "Send Later — Coming Soon",
          ]
            .filter(
              (item) =>
                page !== "Home" || !["Create Room", "Join Room"].includes(item),
            )
            .map((item) => (
              <button
                key={item}
                className={page === item ? "active" : ""}
                onClick={() => choose(item)}
              >
                {item}
              </button>
            ))}
        </nav>
        {started && (
          <div hidden={!sharing}>
            <RoomDashboard
              action={page === "Join Room" ? "Join Room" : "Create Room"}
            />
          </div>
        )}
        {page === "Optical Share" && <OpticalPanel />}
        {page === "Send Later — Coming Soon" && (
          <section className="panel coming-soon">
            <h2>Send Later — Coming Soon</h2>
            <p>Encrypted temporary links are on the way.</p>
          </section>
        )}
        {page === "How It Works" && (
          <section className="panel">
            <h2>Three steps. That’s it.</h2>
            <ol>
              <li>Enter your device name and create or join a room.</li>
              <li>Share the code or QR with someone you trust.</li>
              <li>Choose recipients. Each recipient accepts the files.</li>
            </ol>
            <p>
              Keep both pages open until the transfer completes. Files travel
              over an encrypted connection. Restricted networks may need a
              different connection.
            </p>
          </section>
        )}
        <footer>
          Private sharing. Yours to control.<span>FlowDrop Online · 0.4.1</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<OnlineApp />);
