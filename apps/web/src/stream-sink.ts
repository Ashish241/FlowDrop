export interface StreamSink {
  buffered?: boolean;
  write(bytes: Uint8Array): Promise<void>;
  close(): Promise<Blob | undefined>;
  abort(): void;
}
function memorySink(size: number): StreamSink {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0,
    aborted = false;
  return {
    buffered: true,
    async write(bytes) {
      if (aborted || total + bytes.length > size)
        throw new Error("Invalid download");
      chunks.push(Uint8Array.from(bytes));
      total += bytes.length;
    },
    async close() {
      if (aborted || total !== size) throw new Error("Incomplete download");
      return new Blob(chunks);
    },
    abort() {
      aborted = true;
      chunks.length = 0;
    },
  };
}
export async function createStreamSink(
  name: string,
  size: number,
): Promise<StreamSink> {
  if (!Number.isSafeInteger(size) || size < 0 || size > 20 * 1024 ** 3)
    throw new Error("Invalid download size");
  try {
    return await createBrowserStreamSink(name, size);
  } catch (error) {
    // Some private/mobile browser modes expose the API but prohibit registration.
    // Only fall back before any accepted file bytes, with the same strict memory bound.
    if (size > 128 * 1024 * 1024) throw error;
    return memorySink(size);
  }
}
async function createBrowserStreamSink(
  name: string,
  size: number,
): Promise<StreamSink> {
  if (!Number.isSafeInteger(size) || size < 0 || size > 20 * 1024 ** 3)
    throw new Error("Invalid download size");
  if (!navigator.serviceWorker || !window.isSecureContext) {
    if (size > 128 * 1024 * 1024)
      throw new Error(
        "Large online downloads require a secure context with Service Worker support.",
      );
    return memorySink(size);
  }
  const registration = await navigator.serviceWorker.register("/stream-sw.js", {
    scope: "/",
  });
  if (registration.active?.state !== "activated") {
    const worker = registration.installing || registration.waiting;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Download worker activation timed out"));
      }, 15000);
      function cleanup() {
        clearTimeout(timer);
        worker?.removeEventListener("statechange", changed);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          changed,
        );
      }
      function changed() {
        if (registration.active?.state === "activated") {
          cleanup();
          resolve();
        } else if (worker?.state === "redundant") {
          cleanup();
          reject(new Error("Download worker installation failed"));
        }
      }
      worker?.addEventListener("statechange", changed);
      navigator.serviceWorker.addEventListener("controllerchange", changed);
      changed();
    });
  }
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Download worker did not take control")),
        15000,
      );
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  if (!registration.active) throw new Error("Download worker unavailable");
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
    channel = new MessageChannel(),
    port = channel.port1;
  let credits = 0,
    total = 0,
    failure: Error | undefined;
  type Waiter = {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const waiting: Waiter[] = [];
  let startedResolve: () => void = () => {},
    readyResolve: () => void = () => {},
    closeResolve: () => void = () => {};
  const ready = new Promise<void>((resolve) => (readyResolve = resolve)),
    started = new Promise<void>((resolve) => (startedResolve = resolve)),
    closed = new Promise<void>((resolve) => (closeResolve = resolve));
  function fail(reason: string) {
    failure = new Error(reason);
    for (const waiter of waiting.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(failure);
    }
    readyResolve();
    startedResolve();
    closeResolve();
  }
  port.onmessage = (event) => {
    if (event.data.type === "started") startedResolve();
    if (event.data.type === "ready") readyResolve();
    if (event.data.type === "credit") {
      const waiter = waiting.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      } else credits++;
    }
    if (event.data.type === "closed") closeResolve();
    if (event.data.type === "error")
      fail(event.data.reason || "Download failed");
  };
  port.start();
  registration.active.postMessage({ type: "create-download", id, name, size }, [
    channel.port2,
  ]);
  const readyTimer = setTimeout(
    () => fail("Download worker did not respond"),
    15000,
  );
  await ready;
  clearTimeout(readyTimer);
  if (failure) throw failure;
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = "/stream-download/" + id;
  document.body.appendChild(frame);
  return {
    async write(bytes) {
      if (failure) throw failure;
      if (total + bytes.length > size)
        throw new Error("Too many download bytes");
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        if (!credits)
          await new Promise<void>((resolve, reject) => {
            const waiter: Waiter = {
              resolve,
              reject,
              timer: setTimeout(() => {
                const index = waiting.indexOf(waiter);
                if (index >= 0) waiting.splice(index, 1);
                reject(new Error("Browser download stalled"));
              }, 60000),
            };
            waiting.push(waiter);
          });
        else credits--;
        if (failure) throw failure;
        const copy = Uint8Array.from(bytes.subarray(offset, offset + 65536));
        total += copy.length;
        port.postMessage({ type: "chunk", bytes: copy.buffer }, [copy.buffer]);
      }
    },
    async close() {
      if (failure) throw failure;
      if (total !== size) throw new Error("Incomplete download");
      const startTimer = setTimeout(
        () => fail("Browser download did not start; check permissions"),
        15000,
      );
      await started;
      clearTimeout(startTimer);
      if (failure) throw failure;
      port.postMessage({ type: "close" });
      const timer = setTimeout(
        () => fail("Download completion stalled"),
        15000,
      );
      await closed;
      clearTimeout(timer);
      port.close();
      setTimeout(() => frame.remove(), 30000);
      if (failure) throw failure;
      return undefined;
    },
    abort() {
      port.postMessage({ type: "abort" });
      fail("Transfer cancelled");
      port.close();
      frame.remove();
    },
  };
}
