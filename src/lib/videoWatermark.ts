/**
 * Composites a logo watermark onto a video using canvas + MediaRecorder.
 * Returns a blob URL of the watermarked video.
 */
export async function applyLogoWatermark(
  videoSrc: string,
  logoSrc: string,
  logoSize = 64,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";

    let logoLoaded = false;
    let videoReady = false;

    const tryStart = () => {
      if (!logoLoaded || !videoReady) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;

      // Scale logo to fit logoSize while preserving aspect ratio
      const logoAspect = logoImg.naturalWidth / (logoImg.naturalHeight || 1);
      const drawW = logoSize;
      const drawH = logoSize / logoAspect;
      const padding = 16;
      const logoX = canvas.width - drawW - padding;
      const logoY = canvas.height - drawH - padding;

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };

      recorder.onerror = () => reject(new Error("MediaRecorder error during watermarking"));

      const drawFrame = () => {
        if (video.paused || video.ended) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Draw logo with slight transparency
        ctx.globalAlpha = 0.7;
        ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
        ctx.globalAlpha = 1.0;
        requestAnimationFrame(drawFrame);
      };

      recorder.start();
      video.play().then(() => {
        drawFrame();
      }).catch(reject);

      video.onended = () => {
        // Small delay to let last frames flush
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 200);
      };
    };

    logoImg.onload = () => {
      logoLoaded = true;
      tryStart();
    };
    logoImg.onerror = () => {
      // If logo fails to load, resolve with original video
      console.warn("Logo failed to load, skipping watermark");
      resolve(videoSrc);
    };

    video.oncanplaythrough = () => {
      videoReady = true;
      tryStart();
    };
    video.onerror = () => reject(new Error("Failed to load video for watermarking"));

    // Start loading
    logoImg.src = logoSrc;
    video.src = videoSrc;
  });
}
