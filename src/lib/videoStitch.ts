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

import { supabase } from "@/integrations/supabase/client";

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
  crossfadeDuration?: number; // seconds, default 0.5
}

export interface StitchProgress {
  stage: "loading" | "rendering" | "endcard" | "validating" | "done" | "error";
  clipIndex?: number;
  clipTotal?: number;
  message: string;
}

// ─── Helpers ───────────────────────────────────────────────

async function fetchAsBlob(url: string): Promise<string> {
  // Already a blob URL — return as-is
  if (url.startsWith("blob:")) return url;

  // MUST convert to blob URL so canvas drawing is same-origin (not tainted).
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

    // Last resort: proxy through edge function to bypass CORS
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const proxyResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: "download", provider: "veo", videoUrl: url }),
          }
        );
        if (proxyResp.ok) {
          const blob = await proxyResp.blob();
          if (blob.size > 0) return URL.createObjectURL(blob);
        }
      }
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
  const fontSize = Math.max(18, Math.round(h / 20));
  ctx.font = `700 ${fontSize}px 'Inter', 'SF Pro Display', -apple-system, sans-serif`;
  const maxWidth = w * 0.8;
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

  const lineHeight = fontSize * 1.4;
  const padX = fontSize * 1.8;
  const padY = fontSize * 0.7;

  // Measure widest line for pill width
  let maxLineW = 0;
  for (const ln of lines) {
    const lw = ctx.measureText(ln).width;
    if (lw > maxLineW) maxLineW = lw;
  }

  const pillW = maxLineW + padX * 2;
  const pillH = lines.length * lineHeight + padY * 2;
  const pillX = (w - pillW) / 2;
  const pillY = h - pillH - 40;
  const radius = 16;

  // Gradient pill background
  ctx.save();
  const grad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  grad.addColorStop(1, "rgba(8, 8, 8, 0.88)");
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glass border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text with glow
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(255, 255, 255, 0.45)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "#ffffff";

  // Apply letter spacing via manual character rendering would be heavy;
  // use (letterSpacing) if supported, otherwise just render normally
  try { (ctx as any).letterSpacing = "0.5px"; } catch {}

  lines.forEach((ln, i) => {
    ctx.fillText(ln, w / 2, pillY + padY + i * lineHeight);
  });

  // Reset
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  try { (ctx as any).letterSpacing = "0px"; } catch {}
  ctx.restore();
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

async function validateBlob(blob: Blob, expectedDuration?: number): Promise<{ valid: boolean; error?: string; duration?: number }> {
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
      if (!dur || dur <= 0) {
        resolve({ valid: false, error: `Output video has invalid duration: ${dur}` });
      } else if (!isFinite(dur) && expectedDuration && expectedDuration > 0) {
        console.warn(`[validateBlob] Browser reported Infinity duration, using expected: ${expectedDuration.toFixed(1)}s`);
        resolve({ valid: true, duration: expectedDuration });
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

  // Audio setup — mix voice + music via AudioContext with ducking & limiter
  let voiceElement: HTMLAudioElement | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let musicGainNode: GainNode | null = null;
  let voiceGainNode: GainNode | null = null;

  const hasVoice = !!overlays?.audioUrl;
  const hasMusic = !!overlays?.musicUrl;
  const baseMusicVol = overlays?.musicVolume ?? 0.15;
  const duckedMusicVol = Math.min(baseMusicVol * 0.33, 0.05); // duck to 33% or max 0.05

  if (hasVoice || hasMusic) {
    try {
      audioCtx = new AudioContext();
      const audioDest = audioCtx.createMediaStreamDestination();

      // Master compressor/limiter to prevent clipping
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -3;
      compressor.knee.value = 6;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      compressor.connect(audioDest);

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
        voiceGain.gain.value = 1.4;
        voiceSource.connect(voiceGain);
        voiceGain.connect(compressor);
      }

      // Music track with ducking support
      if (hasMusic) {
        const musicBlobUrl = await fetchAsBlob(overlays!.musicUrl!);
        musicElement = document.createElement("audio");
        musicElement.preload = "auto";
        musicElement.loop = true;
        musicElement.src = musicBlobUrl;
        await new Promise<void>((res, rej) => {
          musicElement!.oncanplaythrough = () => res();
          musicElement!.onerror = () => rej(new Error("Music audio load failed"));
          setTimeout(() => res(), 5000);
        });
        const musicSource = audioCtx.createMediaElementSource(musicElement);
        musicGainNode = audioCtx.createGain();
        // Start at ducked volume if voice is present, else full
        musicGainNode.gain.value = hasVoice ? duckedMusicVol : baseMusicVol;
        musicSource.connect(musicGainNode);
        musicGainNode.connect(compressor);
      }

      audioDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
    } catch (e) {
      console.warn("[stitchClips] Audio mix failed, continuing without audio:", e);
      voiceElement = null;
      musicElement = null;
      musicGainNode = null;
    }
  }

  // Dynamic ducking: lower music when voice is playing, restore when silent
  const updateMusicDucking = () => {
    if (!musicGainNode || !audioCtx || !voiceElement) return;
    const voicePlaying = !voiceElement.paused && !voiceElement.ended && voiceElement.currentTime > 0;
    const targetVol = voicePlaying ? duckedMusicVol : baseMusicVol;
    musicGainNode.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.1);
  };

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
      if (voiceElement) voiceElement.pause();
      if (musicElement) musicElement.pause();
      if (audioCtx) audioCtx.close().catch(() => {});

      // Phase 3: Post-stitch validation
      onProgress?.({ stage: "validating", message: "Validating output..." });
      const blob = new Blob(chunks, { type: mimeType });
      const validation = await validateBlob(blob, cumulativeTime);

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

    if (voiceElement) {
      voiceElement.play().catch(() => console.warn("[stitchClips] Voice play failed"));
    }
    if (musicElement) {
      musicElement.play().catch(() => console.warn("[stitchClips] Music play failed"));
    }

    // Phase 2: Render clips with crossfade transitions
    let clipIndex = 0;
    let clipStartCumulativeTime = 0;
    const crossfadeDur = overlays?.crossfadeDuration ?? 0.5;
    let clipPreStartedByCrossfade = false;

    // Pre-seek next clip for crossfade readiness
    const prepareNextClip = (nextIdx: number) => {
      if (nextIdx < validatedClips.length) {
        const nv = validatedClips[nextIdx].video;
        nv.currentTime = 0;
        nv.pause();
      }
    };

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
      const wasPreStarted = clipPreStartedByCrossfade;
      clipPreStartedByCrossfade = false;

      if (wasPreStarted) {
        // Clip already playing from crossfade — adjust cumulative time for elapsed time
        clipStartCumulativeTime = cumulativeTime - video.currentTime;
      } else {
        clipStartCumulativeTime = cumulativeTime;
        video.currentTime = 0;
      }

      // Pre-load next clip for crossfade
      prepareNextClip(clipIndex + 1);

      onProgress?.({
        stage: "rendering",
        clipIndex,
        clipTotal: validatedClips.length,
        message: `Rendering clip ${clipIndex + 1}/${validatedClips.length}`,
      });

      let animFrame: number;
      let hasDrawnFrame = false;
      let clipDone = false;
      let nextClipStarted = false;

      const isLastClip = clipIndex >= validatedClips.length - 1;
      const fadeStart = effectiveDuration - crossfadeDur;

      const safetyTimeout = setTimeout(() => {
        if (!clipDone) {
          console.warn(`[stitchClips] Clip ${clipIndex + 1} stuck — forcing advance`);
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

        // Update music ducking
        updateMusicDucking();

        if (!video.paused && !video.ended) {
          const t = video.currentTime;
          const inCrossfade = !isLastClip && crossfadeDur > 0 && t >= fadeStart && clipIndex + 1 < validatedClips.length;

          if (inCrossfade) {
            const progress = Math.min((t - fadeStart) / crossfadeDur, 1);

            // Start next clip video if not already
            if (!nextClipStarted) {
              nextClipStarted = true;
              clipPreStartedByCrossfade = true;
              const nv = validatedClips[clipIndex + 1].video;
              nv.currentTime = 0;
              nv.play().catch(() => {});
            }

            // Draw outgoing clip with decreasing alpha
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(video, 0, 0, W, H);

            // Draw incoming clip with increasing alpha
            const nextVideo = validatedClips[clipIndex + 1].video;
            ctx.globalAlpha = progress;
            ctx.drawImage(nextVideo, 0, 0, W, H);

            ctx.globalAlpha = 1.0;
          } else {
            ctx.globalAlpha = 1.0;
            ctx.drawImage(video, 0, 0, W, H);
          }

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
        console.log(`[stitchClips] Clip ${clipIndex + 1}/${validatedClips.length} playing, dur=${effectiveDuration.toFixed(2)}s, crossfade=${crossfadeDur}s`);
        drawFrame();
      };

      if (wasPreStarted) {
        // Already playing from crossfade — just attach draw loop directly
        startDrawing();
      } else {
        video.addEventListener("playing", startDrawing, { once: true });
        video.play().catch((err) => {
          video.removeEventListener("playing", startDrawing);
          console.error(`[stitchClips] Clip ${clipIndex + 1} play failed:`, err);
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#ff4444";
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`Scene ${clipIndex + 1} — playback failed`, W / 2, H / 2);
          ctx.textAlign = "start";
          hasDrawnFrame = true;
          setTimeout(() => finishClip(), 1000);
        });
      }
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
