import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Moon, Plus, LogIn, ScanLine, Clock, ArrowUpRight } from "lucide-react";
import { RoomDashboard } from "./room-dashboard";
import { OpticalPanel } from "./optical";
import "./online-style.css";
type Route = "home" | "create" | "join" | "room" | "optical" | "later";
function route(): Route {
  const hash = location.hash;
  if (new URLSearchParams(hash.slice(1)).has("room")) return "join";
  const path = hash.replace(/^#\/?/, "").toLowerCase();
  if (["home", "create", "join", "room", "optical", "later"].includes(path))
    return path as Route;
  if (hash.includes("online-room")) return "join";
  return sessionStorage.getItem("flowdrop-room-v2") ? "room" : "home";
}
const cards = [
  {
    route: "create",
    title: "Create Room",
    text: "A private space for your devices.",
    icon: Plus,
  },
  {
    route: "join",
    title: "Join Room",
    text: "Connect with a code or scan a QR.",
    icon: LogIn,
  },
  {
    route: "optical",
    title: "Optical Share",
    text: "Share small files, screen to camera.",
    icon: ScanLine,
  },
  {
    route: "later",
    title: "Send Later — Coming Soon",
    text: "Private links for another time.",
    icon: Clock,
  },
] as const;
function OnlineApp() {
  const [page, setPage] = useState<Route>(route),
    [started, setStarted] = useState(() =>
      ["create", "join", "room"].includes(route()),
    ),
    [active, setActive] = useState(
      !!sessionStorage.getItem("flowdrop-room-v2"),
    );
  const [action, setAction] = useState<"Create Room" | "Join Room">(() =>
    route() === "join" ? "Join Room" : "Create Room",
  );
  useEffect(() => {
    function sync() {
      const next = route();
      setPage(next);
      if (["create", "join", "room"].includes(next)) {
        setStarted(true);
        if (next !== "room")
          setAction(next === "join" ? "Join Room" : "Create Room");
      }
    }
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  function go(next: Route) {
    if (active && ["create", "join"].includes(next)) next = "room";
    location.hash = "/" + next;
    setPage(next);
    if (["create", "join", "room"].includes(next)) {
      setStarted(true);
      if (next !== "room")
        setAction(next === "join" ? "Join Room" : "Create Room");
    }
  }
  useEffect(() => {
    const names: Record<Route, string> = {
      home: "Share Anything",
      create: "Create Room",
      join: "Join Room",
      room: "Sharing Room",
      optical: "Optical Share",
      later: "Coming Soon",
    };
    document.title = "FlowDrop - " + names[page];
  }, [page]);
  const inWorkspace = page === "room" && active;
  return (
    <div className="online-app">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="FlowDrop home"
        >
          <img
            className="brand-mark"
            src="/flowdrop-mark.svg"
            alt=""
            width="36"
            height="36"
          />
          FlowDrop<span className="brand-tag">SHARE WITHOUT LIMITS</span>
        </button>
        <div className="header-actions">
          {page !== "home" && !inWorkspace && (
            <button className="quiet" onClick={() => go("home")}>
              Back to Home
            </button>
          )}
          {page === "home" && active && (
            <button onClick={() => go("room")}>Return to Room</button>
          )}
          <button
            className="icon-button quiet"
            aria-label="Toggle theme"
            onClick={() => {
              const dark = document.documentElement.dataset.theme !== "dark";
              try {
                localStorage.setItem("flowdrop-theme", dark ? "dark" : "light");
              } catch {
                /* Private storage can be unavailable. */
              }
              document.documentElement.dataset.theme = dark ? "dark" : "light";
              window.dispatchEvent(new Event("flowdrop-theme"));
            }}
          >
            <Moon size={20} />
          </button>
        </div>
      </header>
      <main className="online-main">
        {page === "home" && (
          <>
            <section className="intro">
              <span className="eyebrow">LESS FRICTION. MORE FLOW.</span>
              <h1>Sharing, in your space.</h1>
              <p>
                Bring your devices together. Choose what to share.
                <br />
                No account. No installation. Just a connection.
              </p>
            </section>
            <nav className="home-actions" aria-label="Sharing options">
              {cards.map(({ route, title, text, icon: Icon }) => (
                <button
                  key={route}
                  aria-label={title}
                  className="home-card"
                  onClick={() => go(route)}
                >
                  <span className="card-top">
                    <Icon size={27} />
                    <ArrowUpRight size={18} />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </button>
              ))}
            </nav>
            <div className="home-note">
              <span className="status-dot" />
              Private by choice. Files travel directly between your devices.
            </div>
          </>
        )}
        {["create", "join"].includes(page) && !active && (
          <section className="entry-intro">
            <span className="eyebrow">YOUR NEXT CONNECTION</span>
            <h1>{page === "create" ? "Create Room" : "Join Room"}</h1>
            <p>A familiar name helps everyone know who’s here.</p>
          </section>
        )}
        {started && (
          <div
            hidden={!["create", "join", "room"].includes(page)}
            className={inWorkspace ? "workspace-mount" : "entry-mount"}
          >
            <RoomDashboard
              action={action}
              onSessionChange={(value) => {
                setActive(value);
                if (value && ["create", "join"].includes(page)) {
                  history.replaceState(null, "", location.pathname + "#/room");
                  setPage("room");
                }
              }}
              onHome={() => go("home")}
            />
          </div>
        )}
        {page === "optical" && (
          <section className="standalone">
            <div className="entry-intro">
              <span className="eyebrow">SCREEN TO CAMERA</span>
              <h1>Optical Share</h1>
            </div>
            <OpticalPanel />
          </section>
        )}
        {page === "later" && (
          <section className="coming-soon panel">
            <Clock size={36} />
            <span className="eyebrow">ON THE HORIZON</span>
            <h1>Send Later — Coming Soon</h1>
            <p>
              Private links for another time. For now, create a room and share
              live.
            </p>
            <button onClick={() => go("create")}>Create Room</button>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>Less friction. More flow.</span>
        <span>FlowDrop Online · Private sharing</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<OnlineApp />);
