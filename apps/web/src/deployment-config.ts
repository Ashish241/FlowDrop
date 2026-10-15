/** Public build configuration only; never put credentials in VITE_* values. */
export function productionSignalingEndpoint(raw: string | undefined): string {
  if (!raw?.trim())
    throw new Error(
      "Set the actual public HTTPS VITE_SIGNAL_URL before building for Pages",
    );
  const url = new URL(raw.trim());
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !host.includes(".") ||
    host.includes(":") ||
    /^[\d.]+$/.test(host) ||
    /(^|\.)(localhost|local|localdomain|lan|home|arpa|internal|invalid|test|example)$/.test(
      host,
    ) ||
    /(^|\.)example\.(com|net|org)$/.test(host) ||
    url.pathname.replace(/\/+$/, "") !== "/signal" ||
    (url.port && url.port !== "443")
  ) {
    throw new Error(
      "Pages requires a real public HTTPS DNS endpoint at /signal, without credentials, query or fragment",
    );
  }
  url.pathname = "/signal";
  return url.href;
}
