/** Browsers cannot abort a permission prompt; release a stream that arrives late. */
export async function openCamera(
  constraints: MediaStreamConstraints,
  timeout = 30000,
): Promise<MediaStream> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const media = navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      if (expired) stream.getTracks().forEach((track) => track.stop());
      return stream;
    });
  try {
    return await Promise.race([
      media,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            new Error(
              "Camera permission timed out. Allow camera access and retry.",
            ),
          );
        }, timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
