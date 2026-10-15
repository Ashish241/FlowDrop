import { useEffect, useState } from "react";
import { OnlinePanel as OnlineClient } from "./online";

type Config = {
  mode: "desktop";
  available: boolean;
  message: string;
  website: string;
  signaling: string;
  development?: boolean;
};
export function OnlinePanel({ desktopToken }: { desktopToken?: string }) {
  const [config, setConfig] = useState<Config>();
  const [hosted, setHosted] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  const [signaling, setSignaling] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    setError("");
    setHosted(false);
    void (async () => {
      const local = await fetch("/api/online/config", {
        signal: controller.signal,
      });
      if (
        local.ok &&
        local.headers.get("content-type")?.includes("application/json")
      ) {
        const settings = (await local.json()) as Config;
        if (settings.mode === "desktop") {
          setConfig(settings);
          setWebsite(settings.website || "");
          setSignaling(settings.signaling || "");
          return;
        }
      } else if (local.status !== 404 && !local.ok)
        throw new Error(
          "Online configuration check failed (" +
            local.status +
            "). Retry after checking the desktop server.",
        );
      if (!window.isSecureContext)
        throw new Error(
          "Online Sharing requires HTTPS. Open the configured public FlowDrop website; a LAN HTTP page cannot be used as a public signaling site.",
        );
      const base =
        (import.meta as unknown as { env: Record<string, string> }).env
          .VITE_SIGNAL_URL || "/signal";
      const endpoint = new URL(base, location.href);
      if (endpoint.origin !== location.origin)
        throw new Error(
          "Use a same-origin HTTPS /signal reverse proxy for the hosted frontend. Cross-origin signaling requires an explicitly reviewed deployment policy.",
        );
      const response = await fetch(base + "/health", {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "Online Sharing is unavailable: signaling service health check failed (" +
            response.status +
            ").",
        );
      const health = await response.json();
      if (health.service !== "signaling" || health.status !== "ok")
        throw new Error(
          "Online Sharing is unavailable: endpoint is not a FlowDrop signaling service.",
        );
      setHosted(true);
    })()
      .catch((reason) => {
        if (active)
          setError(
            reason.name === "AbortError"
              ? "Online Sharing is unavailable: service check timed out. Retry or check the configured endpoints."
              : String(reason),
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [revision]);
  if (hosted) return <OnlineClient />;
  return (
    <section className="panel">
      <h2>Online peer-to-peer</h2>
      <p role="status">
        {error || config?.message || "Checking online service configuration…"}
      </p>
      {config?.available && (
        <>
          <p>
            Online sharing runs on the public HTTPS website. Your LAN
            authorization and files stay in this local application; they are not
            sent to the public site.
          </p>
          <a
            href={config.website + "/#online=1"}
            target="_blank"
            rel="noreferrer"
          >
            Open hosted Online Share
          </a>
          {config.development && (
            <p>
              LOCAL DEVELOPMENT ONLY — this does not provide Internet sharing.
            </p>
          )}
        </>
      )}
      {desktopToken && config && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetch("/api/online/config", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + desktopToken,
              },
              body: JSON.stringify({ website, signaling }),
            })
              .then(async (response) => {
                if (!response.ok) {
                  const body = await response.json();
                  throw new Error(
                    body.detail || "Could not save online configuration",
                  );
                }
                setConfig(undefined);
                setRevision((value) => value + 1);
              })
              .catch((reason) => setError(String(reason)));
          }}
        >
          <label>
            Public FlowDrop website URL
            <input
              type="url"
              placeholder="https://share.example.com"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
          <label>
            Public signaling endpoint
            <input
              type="url"
              placeholder="https://share.example.com/signal"
              value={signaling}
              onChange={(event) => setSignaling(event.target.value)}
            />
          </label>
          <button type="submit">Save online endpoints</button>
          <p>
            Leave the website blank to disable Online Sharing. Only an approved
            HTTPS deployment is accepted; localhost requires explicit
            development configuration.
          </p>
        </form>
      )}
      <button
        onClick={() => {
          setConfig(undefined);
          setRevision((value) => value + 1);
        }}
      >
        Check online service again
      </button>
      <p>Offline LAN remains independent of Internet services.</p>
    </section>
  );
}
