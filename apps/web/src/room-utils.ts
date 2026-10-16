/** Decimal SI sizes: 1 KB = 1,000 bytes. Used consistently in Online UI. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent =
    bytes === 0 ? 0 : Math.min(4, Math.floor(Math.log10(bytes) / 3));
  const value = bytes / 1000 ** exponent;
  return `${exponent === 0 ? Math.round(value) : Number(value.toFixed(value >= 100 ? 0 : 1))} ${units[exponent]}`;
}
export function mergeAttachments(existing: File[], added: File[]): File[] {
  const key = (file: File) =>
    `${file.webkitRelativePath || file.name}\0${file.size}\0${file.lastModified}\0${file.type}`;
  const seen = new Set(existing.map(key));
  return [
    ...existing,
    ...added.filter((file) => {
      const id = key(file);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
}
export function invitationCode(
  value: string,
  origin = location.origin,
): string {
  const url = new URL(value);
  if (
    url.origin !== origin ||
    url.pathname !== "/" ||
    url.search ||
    url.username ||
    url.password
  )
    throw new Error("Scan a FlowDrop invitation from this website.");
  const params = new URLSearchParams(url.hash.slice(1)),
    code = params.get("room");
  if (
    !code ||
    !/^\d{6}$/.test(code) ||
    [...params.keys()].some((key) => key !== "room")
  )
    throw new Error(
      "This QR is not a valid room invitation. Enter a six-digit code instead.",
    );
  return code;
}
