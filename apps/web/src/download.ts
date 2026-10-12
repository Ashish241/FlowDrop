type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;
};
export async function saveResponse(
  response: Response,
  name: string,
  size: number,
) {
  const picker = (window as SaveWindow).showSaveFilePicker;
  if (picker && window.isSecureContext) {
    const handle = await picker({ suggestedName: name });
    const output = await handle.createWritable();
    if (!response.body) throw new Error("Download stream unavailable");
    await response.body.pipeTo(output);
    return;
  }
  if (size > 128 * 1024 * 1024)
    throw new Error(
      "This browser cannot stream large saves. Use the host browser on localhost with File System Access support. Buffered downloads are limited to 128 MiB.",
    );
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
