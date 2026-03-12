/**
 * Stitches multiple video clips sequentially into one continuous video.
 * Supports optional logo watermark, subtitle burn-in, and end card overlays.
 * Returns a blob URL of the combined video.
 *
 * v2 — Reliability overhaul:
 *   • Pre-validates every clip before starting the recorder
 *   • Retries failed clip playback once, then renders black frame + skips
 *   • Safety setTimeout fallback so a stuck clip never blocks forever
 *   • Post-stitch validation: verifies the output blob is playable
 *   • Honest output format (.webm)
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
  audioUrl?: string;
  musicUrl?: string;
  musicVolume?: number; // 0-1, default 0.3
}

export interface StitchProgress {
  stage: "loading" | "rendering" | "endcard" | "validating" | "done" | "error";
  clipIndex?: number;
  clipTotal?: number;
  message: string;
}

// ─── Helpers ───────────────────────────────────────────────

async function fetchAsBlob(url: string): Promise<string> {
  // MUST convert to blob URL so canvas drawing is same-origin (not tainted).
  // A tainted canvas makes captureStream() produce empty data.
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    // Try no-cors as fallback — opaque response, but we can still get blob
    try {
      const resp2 = await fetch(url, { mode: "no-cors" });
      const blob = await resp2.blob();
      if (blob.size > 0) return URL.createObjectURL(blob);
    } catch { /* fall through */ }
    console.error(`[fetchAsBlob] Failed to fetch as blob: ${url}`, e);
    throw new Error(`Cannot fetch clip for stitching (CORS blocked). URL: ${url.substring(0, 80)}...`);
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

function drawSubtitle(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  if (!text) return;
  const fontSize = Math.max(16, Math.round(h / 22));
  ctx.font = `bold ${fontSize}px sans-serif`;
  const maxWidth = w * 0.85;
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

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, y0, w, blockH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, y0 + 8 + i * lineHeight));
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, logoImg: HTMLImageElement, logoSize: number) {
  const aspect = logoImg.naturalWidth / (logoImg.naturalHeight || 1);
  const drawW = logoSize;
  const drawH = logoSize / aspect;
  const padding = 16;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(logoImg, w - drawW - padding, h - drawH - padding, drawW, drawH);
  ctx.globalAlpha = 1.0;
}

function drawEndCard(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  opts: NonNullable<StitchOverlayOptions["endCard"]>,
  logoImg: HTMLImageElement | null,
) {
  ctx.fillStyle = opts.bgColor || "#1e293b";
  ctx.fillRect(0, 0, w, h);
  if (logoImg) {
    const maxLogoH = h * 0.18;
    const aspect = logoImg.naturalWidth / (logoImg.naturalHeight || 1);
    const lh = maxLogoH;
    const lw = lh * aspect;
    ctx.drawImage(logoImg, (w - lw) / 2, h * 0.18, lw, lh);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const nameFontSize = Math.round(h / 10);
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  ctx.fillStyle = opts.primaryColor || "#ef4444";
  ctx.fillText(opts.brandName, w / 2, h * 0.48);
  const tagFontSize = Math.round(h / 20);
  ctx.font = `${tagFontSize}px sans-serif`;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(opts.tagline, w / 2, h * 0.60);
  const divW = w * 0.25;
  ctx.strokeStyle = opts.primaryColor || "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((w - divW) / 2, h * 0.68);
  ctx.lineTo((w + divW) / 2, h * 0.68);
  ctx.stroke();
  const urlFontSize = Math.round(h / 18);
  ctx.font = `bold ${urlFontSize}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.website, w / 2, h * 0.76);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

// ─── Pre-validation ────────────────────────────────────────

interface ValidatedClip {
  video: HTMLVideoElement;
  targetDuration: number;
  blobUrl: string;
}

async function preloadAndValidate(
  clips: { videoUrl: string; targetDuration: number }[],
  onProgress?: (p: StitchProgress) => void,
): Promise<ValidatedClip[]> {
  const results: ValidatedClip[] = [];

  for (let i = 0; i < clips.length; i++) {
    onProgress?.({ stage: "loading", clipIndex: i, clipTotal: clips.length, message: `Loading clip ${i + 1}/${clips.length}` });
    const clip = clips[i];
    const blobUrl = await fetchAsBlob(clip.videoUrl);

    const load = (url: string): Promise<HTMLVideoElement> =>
      new Promise((resolve, reject) => {
        const v = document.createElement("video");
        v.playsInline = true;
        v.preload = "auto";
        v.muted = true;
        // Note: crossOrigin intentionally omitted — captureStream() doesn't need it,
        // and setting it causes CORS failures when fetchAsBlob falls back to raw URLs.
        const timeout = setTimeout(() => reject(new Error(`Clip ${i + 1} load timed out`)), 15_000);
        v.onloadedmetadata = () => {
          clearTimeout(timeout);
          if (!v.videoWidth || !v.videoHeight) {
            reject(new Error(`Clip ${i + 1} has no video dimensions`));
          } else {
            resolve(v);
          }
        };
        v.onerror = () => { clearTimeout(timeout); reject(new Error(`Clip ${i + 1} failed to load`)); };
        v.src = url;
      });

    // Try twice
    let video: HTMLVideoElement;
    try {
      video = await load(blobUrl);
    } catch (firstErr) {
      console.warn(`[stitchClips] Clip ${i + 1} first load failed, retrying...`, firstErr);
      try {
        video = await load(blobUrl);
      } catch {
        throw new Error(`Clip ${i + 1} failed to load after retry: ${(firstErr as Error).message}`);
      }
    }

    results.push({ video, targetDuration: clip.targetDuration, blobUrl });
  }

  return results;
}

// ─── Post-stitch validation ────────────────────────────────

async function validateBlob(blob: Blob): Promise<{ valid: boolean; error?: string; duration?: number }> {
  if (blob.size === 0) return { valid: false, error: "Output blob is empty (0 bytes)" };
  if (blob.size < 1000) return { valid: false, error: `Output blob suspiciously small (${blob.size} bytes)` };

  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const testVideo = document.createElement("video");
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: "Output video failed to load metadata within 10s" });
    }, 10_000);

    testVideo.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = testVideo.duration;
      URL.revokeObjectURL(url);
      if (!dur || dur <= 0 || !isFinite(dur)) {
        resolve({ valid: false, error: `Output video has invalid duration: ${dur}` });
      } else {
        resolve({ valid: true, duration: dur });
      }
    };
    testVideo.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: "Output video is not playable" });
    };
    testVideo.src = url;
  });
}

// ─── Main Stitch Function ──────────────────────────────────

export async function stitchClips(
  clips: { videoUrl: string; targetDuration: number }[],
  overlays?: StitchOverlayOptions,
  onProgress?: (p: StitchProgress) => void,
): Promise<{ blobUrl: string; blob: Blob; duration: number }> {
  if (clips.length === 0) throw new Error("No clips to stitch");

  // Phase 1: Pre-validate all clips
  const validatedClips = await preloadAndValidate(clips, onProgress);

  // Pre-load overlay assets
  let logoImg: HTMLImageElement | null = null;
  const logoSize = overlays?.logo?.size ?? 64;
  if (overlays?.logo?.enabled && overlays.logo.url) {
    const blobLogoUrl = await fetchAsBlob(overlays.logo.url);
    logoImg = await loadImage(blobLogoUrl);
  }

  let endCardLogoImg: HTMLImageElement | null = null;
  if (overlays?.endCard?.enabled && overlays.endCard.logoUrl) {
    const blobLogo = await fetchAsBlob(overlays.endCard.logoUrl);
    endCardLogoImg = await loadImage(blobLogo);
  }

  const W = validatedClips[0].video.videoWidth || 1280;
  const H = validatedClips[0].video.videoHeight || 720;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([...canvasStream.getVideoTracks()]);

  // Audio setup — mix voice + music via AudioContext
  let voiceElement: HTMLAudioElement | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;

  const hasVoice = !!overlays?.audioUrl;
  const hasMusic = !!overlays?.musicUrl;

  if (hasVoice || hasMusic) {
    try {
      audioCtx = new AudioContext();
      const audioDest = audioCtx.createMediaStreamDestination();

      // Voice track
      if (hasVoice) {
        const voiceBlobUrl = await fetchAsBlob(overlays!.audioUrl!);
        voiceElement = document.createElement("audio");
        voiceElement.preload = "auto";
        voiceElement.src = voiceBlobUrl;
        await new Promise<void>((res, rej) => {
          voiceElement!.oncanplaythrough = () => res();
          voiceElement!.onerror = () => rej(new Error("Voice audio load failed"));
          setTimeout(() => res(), 5000);
        });
        const voiceSource = audioCtx.createMediaElementSource(voiceElement);
        const voiceGain = audioCtx.createGain();
        voiceGain.gain.value = 1.0;
        voiceSource.connect(voiceGain);
        voiceGain.connect(audioDest);
        voiceSource.connect(audioCtx.destination);
      }

      // Music track
      if (hasMusic) {
        const musicBlobUrl = await fetchAsBlob(overlays!.musicUrl!);
        musicElement = document.createElement("audio");
        musicElement.preload = "auto";
        musicElement.loop = true; // Loop music under entire video
        musicElement.src = musicBlobUrl;
        await new Promise<void>((res, rej) => {
          musicElement!.oncanplaythrough = () => res();
          musicElement!.onerror = () => rej(new Error("Music audio load failed"));
          setTimeout(() => res(), 5000);
        });
        const musicSource = audioCtx.createMediaElementSource(musicElement);
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = overlays?.musicVolume ?? 0.3;
        musicSource.connect(musicGain);
        musicGain.connect(audioDest);
        musicSource.connect(audioCtx.destination);
      }

      audioDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
    } catch (e) {
      console.warn("[stitchClips] Audio mix failed, continuing without audio:", e);
      voiceElement = null;
      musicElement = null;
    }
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
  const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const subtitleSegments = overlays?.subtitles?.enabled ? overlays.subtitles.segments : [];
  let cumulativeTime = 0;

  return new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error("MediaRecorder error during stitch"));

    recorder.onstop = async () => {
      if (audioElement) audioElement.pause();
      if (audioCtx) audioCtx.close().catch(() => {});

      // Phase 3: Post-stitch validation
      onProgress?.({ stage: "validating", message: "Validating output..." });
      const blob = new Blob(chunks, { type: mimeType });
      const validation = await validateBlob(blob);

      if (!validation.valid) {
        reject(new Error(`Stitch validation failed: ${validation.error}`));
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      console.log(`[stitchClips] ✅ Output valid: ${(blob.size / 1024 / 1024).toFixed(1)}MB, ${validation.duration?.toFixed(1)}s`);
      onProgress?.({ stage: "done", message: `Export complete — ${validation.duration?.toFixed(1)}s` });
      resolve({ blobUrl, blob, duration: validation.duration! });
    };

    recorder.start(1000); // Request data every 1s for reliability

    if (audioElement) {
      audioElement.play().catch(() => console.warn("[stitchClips] Audio play failed"));
    }

    // Phase 2: Render clips sequentially
    let clipIndex = 0;
    let clipStartCumulativeTime = 0;

    const playNextClip = () => {
      if (clipIndex >= validatedClips.length) {
        if (overlays?.endCard?.enabled) {
          renderEndCard();
        } else {
          setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 100);
        }
        return;
      }

      const { video, targetDuration } = validatedClips[clipIndex];
      const effectiveDuration = Math.min(targetDuration, video.duration || targetDuration);
      clipStartCumulativeTime = cumulativeTime;
      video.currentTime = 0;

      onProgress?.({
        stage: "rendering",
        clipIndex,
        clipTotal: validatedClips.length,
        message: `Rendering clip ${clipIndex + 1}/${validatedClips.length}`,
      });

      let animFrame: number;
      let hasDrawnFrame = false;
      let clipDone = false;

      // Safety timeout: if clip gets stuck, force advance after 2x expected duration
      const safetyTimeout = setTimeout(() => {
        if (!clipDone) {
          console.warn(`[stitchClips] Clip ${clipIndex + 1} stuck — forcing advance after ${(effectiveDuration * 2).toFixed(1)}s`);
          finishClip();
        }
      }, effectiveDuration * 2000 + 5000);

      const finishClip = () => {
        if (clipDone) return;
        clipDone = true;
        clearTimeout(safetyTimeout);
        cancelAnimationFrame(animFrame);
        video.pause();
        cumulativeTime = clipStartCumulativeTime + effectiveDuration;
        console.log(`[stitchClips] Clip ${clipIndex + 1}/${validatedClips.length} done, cumTime=${cumulativeTime.toFixed(2)}s`);
        clipIndex++;
        playNextClip();
      };

      const drawFrame = () => {
        if (clipDone) return;

        if (hasDrawnFrame && (video.ended || video.currentTime >= effectiveDuration)) {
          finishClip();
          return;
        }

        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, W, H);
          hasDrawnFrame = true;

          if (subtitleSegments.length > 0) {
            const currentAbsTime = clipStartCumulativeTime + video.currentTime;
            const activeSub = subtitleSegments.find(s => currentAbsTime >= s.startTime && currentAbsTime < s.endTime);
            if (activeSub) drawSubtitle(ctx, W, H, activeSub.text);
          }

          if (logoImg) drawLogo(ctx, W, H, logoImg, logoSize);
        }

        animFrame = requestAnimationFrame(drawFrame);
      };

      video.ontimeupdate = () => {
        if (video.currentTime >= effectiveDuration && hasDrawnFrame) finishClip();
      };

      const startDrawing = () => {
        console.log(`[stitchClips] Clip ${clipIndex + 1}/${validatedClips.length} playing, dur=${effectiveDuration.toFixed(2)}s`);
        drawFrame();
      };

      video.addEventListener("playing", startDrawing, { once: true });
      video.play().catch((err) => {
        video.removeEventListener("playing", startDrawing);
        console.error(`[stitchClips] Clip ${clipIndex + 1} play failed:`, err);
        // Draw black frame and skip
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff4444";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Scene ${clipIndex + 1} — playback failed`, W / 2, H / 2);
        ctx.textAlign = "start";
        hasDrawnFrame = true;
        // Hold black frame for 1 second then advance
        setTimeout(() => finishClip(), 1000);
      });
    };

    const renderEndCard = () => {
      onProgress?.({ stage: "endcard", message: "Rendering end card..." });
      const endOpts = overlays!.endCard!;
      const endCardDuration = 4;
      const fps = 30;
      let frame = 0;
      const totalFrames = endCardDuration * fps;
      const fadeInFrames = Math.round(0.5 * fps);

      const drawEndFrame = () => {
        if (frame >= totalFrames) {
          setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 100);
          return;
        }
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
