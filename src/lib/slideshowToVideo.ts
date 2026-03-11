/**
 * Compiles an array of image URLs into a video with Ken Burns zoom/pan effects
 * and crossfade transitions using canvas + MediaRecorder.
 * Returns a blob URL of the resulting video.
 */

interface SlideshowOptions {
  imageUrls: string[];
  /** Duration per image in seconds (default: 5) */
  durationPerImage?: number;
  /** Crossfade duration in seconds (default: 0.8) */
  crossfadeDuration?: number;
  /** Output resolution width (default: 1280) */
  width?: number;
  /** Output resolution height (default: 720) */
  height?: number;
  /** Progress callback (0-100) */
  onProgress?: (pct: number) => void;
}

// Ken Burns effect presets — each defines start/end crop regions
const kenBurnsPresets = [
  // Slow zoom in center
  { sx: 0, sy: 0, sw: 1, sh: 1, ex: 0.1, ey: 0.1, ew: 0.8, eh: 0.8 },
  // Pan left to right
  { sx: 0, sy: 0.05, sw: 0.75, sh: 0.9, ex: 0.25, ey: 0.05, ew: 0.75, eh: 0.9 },
  // Zoom out from center
  { sx: 0.15, sy: 0.15, sw: 0.7, sh: 0.7, ex: 0, ey: 0, ew: 1, eh: 1 },
  // Pan right to left
  { sx: 0.25, sy: 0.05, sw: 0.75, sh: 0.9, ex: 0, ey: 0.05, ew: 0.75, eh: 0.9 },
  // Slight zoom + pan down
  { sx: 0.05, sy: 0, sw: 0.9, sh: 0.85, ex: 0.05, ey: 0.15, ew: 0.9, eh: 0.85 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function slideshowToVideo(opts: SlideshowOptions): Promise<string> {
  const {
    imageUrls,
    durationPerImage = 5,
    crossfadeDuration = 0.8,
    width = 1280,
    height = 720,
    onProgress,
  } = opts;

  if (imageUrls.length === 0) throw new Error("No images provided");

  // Load all images first
  const images = await Promise.all(imageUrls.map(loadImage));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const fps = 30;
  const totalDuration = durationPerImage * images.length;
  const totalFrames = Math.ceil(totalDuration * fps);

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<string>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("MediaRecorder error during slideshow"));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };

    recorder.start();

    let frame = 0;

    const renderFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }

      const currentTime = frame / fps;
      const imageIndex = Math.min(
        Math.floor(currentTime / durationPerImage),
        images.length - 1
      );
      const timeInSlide = currentTime - imageIndex * durationPerImage;
      const slideProgress = timeInSlide / durationPerImage; // 0..1

      // Pick Ken Burns preset for this slide
      const kb = kenBurnsPresets[imageIndex % kenBurnsPresets.length];
      const img = images[imageIndex];

      // Interpolate crop region
      const sx = lerp(kb.sx, kb.ex, slideProgress) * img.naturalWidth;
      const sy = lerp(kb.sy, kb.ey, slideProgress) * img.naturalHeight;
      const sw = lerp(kb.sw, kb.ew, slideProgress) * img.naturalWidth;
      const sh = lerp(kb.sh, kb.eh, slideProgress) * img.naturalHeight;

      // Clear and draw current image with Ken Burns crop
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

      // Crossfade: blend next image at end of slide
      const fadeStart = durationPerImage - crossfadeDuration;
      if (timeInSlide > fadeStart && imageIndex < images.length - 1) {
        const fadeProgress = (timeInSlide - fadeStart) / crossfadeDuration;
        const nextImg = images[imageIndex + 1];
        const nextKb = kenBurnsPresets[(imageIndex + 1) % kenBurnsPresets.length];

        // Start of next image's Ken Burns
        const nsx = nextKb.sx * nextImg.naturalWidth;
        const nsy = nextKb.sy * nextImg.naturalHeight;
        const nsw = nextKb.sw * nextImg.naturalWidth;
        const nsh = nextKb.sh * nextImg.naturalHeight;

        ctx.globalAlpha = fadeProgress;
        ctx.drawImage(nextImg, nsx, nsy, nsw, nsh, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }

      frame++;
      if (onProgress) {
        onProgress(Math.round((frame / totalFrames) * 100));
      }

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  });
}
