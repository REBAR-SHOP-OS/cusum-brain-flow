/**
 * Stitches multiple video clips sequentially into one continuous video.
 * Supports optional logo watermark, subtitle burn-in, and end card overlays.
 * Returns a blob URL of the combined video.
 */

export interface StitchOverlayOptions {
  logo?: { url: string; enabled: boolean; size?: number };
  endCard?: {
    enabled: boolean;
    brandName: string;
    tagline: string;
    website: string;
    primaryColor: string;
    bgColor: string;
    logoUrl?: string | null;
  };
  subtitles?: {
    enabled: boolean;
    segments: { text: string; startTime: number; endTime: number }[];
  };
}

async function fetchAsBlob(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
) {
  if (!text) return;
  const fontSize = Math.max(16, Math.round(h / 22));
  ctx.font = `bold ${fontSize}px sans-serif`;
  const maxWidth = w * 0.85;
  // Word-wrap
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = fontSize * 1.3;
  const blockH = lines.length * lineHeight + 16;
  const y0 = h - blockH - 24;

  // Semi-transparent background bar
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, y0, w, blockH);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => {
    ctx.fillText(ln, w / 2, y0 + 8 + i * lineHeight);
  });
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  logoImg: HTMLImageElement,
  logoSize: number,
) {
  const aspect = logoImg.naturalWidth / (logoImg.naturalHeight || 1);
  const drawW = logoSize;
  const drawH = logoSize / aspect;
  const padding = 16;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(logoImg, w - drawW - padding, h - drawH - padding, drawW, drawH);
  ctx.globalAlpha = 1.0;
}

function drawEndCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: NonNullable<StitchOverlayOptions["endCard"]>,
  logoImg: HTMLImageElement | null,
) {
  // Background
  ctx.fillStyle = opts.bgColor || "#1e293b";
  ctx.fillRect(0, 0, w, h);

  // Logo centered if available
  if (logoImg) {
    const maxLogoH = h * 0.18;
    const aspect = logoImg.naturalWidth / (logoImg.naturalHeight || 1);
    const lh = maxLogoH;
    const lw = lh * aspect;
    ctx.drawImage(logoImg, (w - lw) / 2, h * 0.18, lw, lh);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Brand name
  const nameFontSize = Math.round(h / 10);
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  ctx.fillStyle = opts.primaryColor || "#ef4444";
  ctx.fillText(opts.brandName, w / 2, h * 0.48);

  // Tagline
  const tagFontSize = Math.round(h / 20);
  ctx.font = `${tagFontSize}px sans-serif`;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(opts.tagline, w / 2, h * 0.60);

  // Divider
  const divW = w * 0.25;
  ctx.strokeStyle = opts.primaryColor || "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((w - divW) / 2, h * 0.68);
  ctx.lineTo((w + divW) / 2, h * 0.68);
  ctx.stroke();

  // Website
  const urlFontSize = Math.round(h / 18);
  ctx.font = `bold ${urlFontSize}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.website, w / 2, h * 0.76);

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export async function stitchClips(
  clips: { videoUrl: string; targetDuration: number }[],
  overlays?: StitchOverlayOptions,
): Promise<string> {
  if (clips.length === 0) throw new Error("No clips to stitch");

  // Pre-fetch all clips as blobs to bypass CORS
  const blobUrls = await Promise.all(clips.map(c => fetchAsBlob(c.videoUrl)));

  // Pre-load logo if needed
  let logoImg: HTMLImageElement | null = null;
  const logoSize = overlays?.logo?.size ?? 64;
  if (overlays?.logo?.enabled && overlays.logo.url) {
    const blobLogoUrl = await fetchAsBlob(overlays.logo.url);
    logoImg = await loadImage(blobLogoUrl);
  }

  // Pre-load end card logo
  let endCardLogoImg: HTMLImageElement | null = null;
  if (overlays?.endCard?.enabled && overlays.endCard.logoUrl) {
    const blobLogo = await fetchAsBlob(overlays.endCard.logoUrl);
    endCardLogoImg = await loadImage(blobLogo);
  }

  // Load all videos
  const videos = await Promise.all(
    clips.map(
      (clip, i) =>
        new Promise<{ video: HTMLVideoElement; target: number }>((resolve, reject) => {
          const video = document.createElement("video");
          video.playsInline = true;
          video.preload = "auto";
          video.muted = true;
          video.onloadedmetadata = () => resolve({ video, target: clip.targetDuration });
          video.onerror = () => reject(new Error(`Failed to load clip: ${clip.videoUrl}`));
          video.src = blobUrls[i];
        })
    )
  );

  const canvas = document.createElement("canvas");
  canvas.width = videos[0].video.videoWidth || 1280;
  canvas.height = videos[0].video.videoHeight || 720;
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;

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

  // Build subtitle lookup: cumulative time → segment text
  const subtitleSegments = overlays?.subtitles?.enabled
    ? overlays.subtitles.segments
    : [];

  // Track cumulative elapsed time for subtitle matching
  let cumulativeTime = 0;

  return new Promise<string>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Stitch recording failed"));

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };

    recorder.start();

    let clipIndex = 0;
    let clipStartCumulativeTime = 0;

    const playNextClip = () => {
      if (clipIndex >= videos.length) {
        // After all clips, render end card if enabled
        if (overlays?.endCard?.enabled) {
          renderEndCard();
        } else {
          setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
          }, 100);
        }
        return;
      }

      const { video, target } = videos[clipIndex];
      const effectiveDuration = Math.min(target, video.duration || target);
      clipStartCumulativeTime = cumulativeTime;
      video.currentTime = 0;

      let animFrame: number;
      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= effectiveDuration) {
          cancelAnimationFrame(animFrame);
          video.pause();
          cumulativeTime = clipStartCumulativeTime + effectiveDuration;
          clipIndex++;
          playNextClip();
          return;
        }

        // Draw video frame
        ctx.drawImage(video, 0, 0, W, H);

        // Overlay: subtitles
        if (subtitleSegments.length > 0) {
          const currentAbsTime = clipStartCumulativeTime + video.currentTime;
          const activeSub = subtitleSegments.find(
            s => currentAbsTime >= s.startTime && currentAbsTime < s.endTime
          );
          if (activeSub) {
            drawSubtitle(ctx, W, H, activeSub.text);
          }
        }

        // Overlay: logo
        if (logoImg) {
          drawLogo(ctx, W, H, logoImg, logoSize);
        }

        animFrame = requestAnimationFrame(drawFrame);
      };

      video.ontimeupdate = () => {
        if (video.currentTime >= effectiveDuration) {
          video.pause();
        }
      };

      video.play()
        .then(() => drawFrame())
        .catch(reject);
    };

    const renderEndCard = () => {
      const endOpts = overlays!.endCard!;
      const endCardDuration = 4; // seconds
      const fps = 30;
      let frame = 0;
      const totalFrames = endCardDuration * fps;
      const fadeInFrames = Math.round(0.5 * fps); // 0.5s fade-in

      const drawEndFrame = () => {
        if (frame >= totalFrames) {
          setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
          }, 100);
          return;
        }
        // Fade-in: draw black first, then end card with increasing opacity
        if (frame < fadeInFrames) {
          ctx.fillStyle = endOpts.bgColor || "#1e293b";
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = frame / fadeInFrames;
        }
        drawEndCard(ctx, W, H, endOpts, endCardLogoImg);
        ctx.globalAlpha = 1.0;
        frame++;
        requestAnimationFrame(drawEndFrame);
      };
      drawEndFrame();
    };

    playNextClip();
  });
}
