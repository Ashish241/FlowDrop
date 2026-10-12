/* Local download streams only. No caching, remote fetches, or persistent file storage. */
const downloads = new Map();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  const data = event.data,
    port = event.ports[0];
  if (
    !port ||
    data?.type !== "create-download" ||
    !/^[a-f0-9]{32}$/.test(data.id) ||
    !Number.isSafeInteger(data.size) ||
    data.size < 0 ||
    typeof data.name !== "string"
  )
    return;
  const entry = {
    port,
    size: data.size,
    name: data.name,
    received: 0,
    controller: null,
    resolvePull: null,
    claimed: false,
  };
  downloads.set(data.id, entry);
  function fail(reason) {
    try {
      entry.controller?.error(new Error(reason));
    } catch {
      /* Already closed. */
    }
    entry.resolvePull?.();
    downloads.delete(data.id);
    port.postMessage({ type: "error", reason });
  }
  port.onmessage = (message) => {
    try {
      if (message.data.type === "chunk") {
        const bytes = new Uint8Array(message.data.bytes);
        if (
          !entry.controller ||
          !entry.resolvePull ||
          bytes.length > 65536 ||
          entry.received + bytes.length > entry.size
        ) {
          fail("Invalid stream frame");
          return;
        }
        entry.received += bytes.length;
        entry.controller.enqueue(bytes);
        const resolve = entry.resolvePull;
        entry.resolvePull = null;
        resolve();
      } else if (message.data.type === "close") {
        if (entry.received !== entry.size) {
          fail("Incomplete download");
          return;
        }
        entry.controller.close();
        entry.resolvePull?.();
        downloads.delete(data.id);
        port.postMessage({ type: "closed" });
      } else if (message.data.type === "abort") fail("Transfer cancelled");
    } catch {
      fail("Download stream failed");
    }
  };
  port.start();
  port.postMessage({ type: "ready" });
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/stream-download/")
  )
    return;
  const id = url.pathname.slice("/stream-download/".length),
    entry = downloads.get(id);
  if (!entry || entry.claimed) {
    event.respondWith(new Response("Download unavailable", { status: 404 }));
    return;
  }
  entry.claimed = true;
  const stream = new ReadableStream(
    {
      start(controller) {
        entry.controller = controller;
        entry.port.postMessage({ type: "started" });
      },
      pull() {
        return new Promise((resolve) => {
          entry.resolvePull = resolve;
          entry.port.postMessage({ type: "credit" });
        });
      },
      cancel() {
        downloads.delete(id);
        entry.resolvePull?.();
        entry.port.postMessage({
          type: "error",
          reason: "Browser cancelled the download",
        });
      },
    },
    { highWaterMark: 0 },
  );
  event.respondWith(
    new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition":
          "attachment; filename*=UTF-8''" + encodeURIComponent(entry.name),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    }),
  );
});
