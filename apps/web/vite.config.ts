import { defineConfig, loadEnv } from "vite";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { productionSignalingEndpoint } from "./src/deployment-config";

export default defineConfig(({ mode }) => {
  const online = mode === "online";
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const pagesRelease = online && process.env.FLOWDROP_PAGES_RELEASE === "1";
  if (pagesRelease)
    env.VITE_SIGNAL_URL = productionSignalingEndpoint(env.VITE_SIGNAL_URL);
  let origin = "";
  if (online && env.VITE_SIGNAL_URL) {
    const url = new URL(env.VITE_SIGNAL_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Online build requires an absolute HTTPS VITE_SIGNAL_URL without credentials/query/fragment",
      );
    origin = url.origin;
  }
  return {
    define: {
      __DESKTOP__: JSON.stringify(mode === "desktop"),
      ...(pagesRelease
        ? {
            "import.meta.env.VITE_SIGNAL_URL": JSON.stringify(
              env.VITE_SIGNAL_URL,
            ),
          }
        : {}),
    },
    build: {
      outDir: online
        ? "dist-online"
        : mode === "desktop"
          ? "dist-desktop"
          : "dist",
    },
    plugins: [
      {
        name: "flowdrop-product",
        transformIndexHtml: {
          order: "pre",
          handler(html) {
            return online
              ? html
                  .replace("/src/main.tsx", "/src/online-main.tsx")
                  .replace("FlowDrop</title>", "FlowDrop Online</title>")
              : html;
          },
        },
        closeBundle() {
          if (mode === "desktop")
            rmSync(resolve("dist-desktop/stream-sw.js"), { force: true });
        },
        generateBundle() {
          if (!online) return;
          this.emitFile({
            type: "asset",
            fileName: "DEPLOYMENT_INFO.json",
            source: JSON.stringify(
              {
                product: "FlowDrop Online",
                version: "0.4.1",
                revision: "rooms-v2-20261016",
                integrityGuard: true,
                signaling: env.VITE_SIGNAL_URL || "/signal",
                pagesRelease,
                publicEndpointValidated: pagesRelease,
                note: "Configuration validation is not deployment or Internet verification",
              },
              null,
              2,
            ),
          });
          const connect = origin
            ? ` ${origin} ${origin.replace(/^https:/, "wss:")}`
            : "";
          this.emitFile({
            type: "asset",
            fileName: "_headers",
            source: `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'${connect}; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n`,
          });
        },
      },
    ],
  };
});
