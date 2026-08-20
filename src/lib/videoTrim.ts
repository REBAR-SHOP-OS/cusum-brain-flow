/**
 * Trims a video client-side using canvas + MediaRecorder.
 * Returns a blob URL of the trimmed clip.
 */
export async function trimVideo(
  videoSrc: string,
  startTime: number,
  endTime: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true;

    video.onloadedmetadata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;

      const canvasStream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };

      recorder.onerror = () => reject(new Error("Trim recording failed"));

      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= endTime) {
          if (recorder.state === "recording") recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };

      video.currentTime = startTime;

      video.onseeked = () => {
        recorder.start();
        video.play().then(drawFrame).catch(reject);
      };

      video.ontimeupdate = () => {
        if (video.currentTime >= endTime) {
          video.pause();
          if (recorder.state === "recording") {
            setTimeout(() => recorder.stop(), 100);
          }
        }
      };
    };

    video.onerror = () => reject(new Error("Failed to load video for trimming"));
    video.src = videoSrc;
  });
}
