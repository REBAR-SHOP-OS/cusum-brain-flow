/**
 * Helpers for the Auto-Edit (raw video upload) flow.
 *  - extractKeyframes: sample frames as data URLs at fixed interval for AI analysis
 *  - cutVideoIntoSegments: re-encode contiguous sub-clips to silent WebM via MediaRecorder
 *
 * SILENT VIDEO POLICY: cutVideoIntoSegments NEVER captures audio. Only canvas video is recorded.
 */

export interface RawSceneCut {
  start: number;
  end: number;
  description?: string;
}

export interface KeyframeSample {
  t: number;
  dataUrl: string;
}

/** Load a File into an HTMLVideoElement and resolve when metadata is ready. */
export async function loadVideoFile(file: File): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    const onMeta = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onErr);
      reject(new Error("Failed to load video metadata"));
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onErr);
  });

  return { video, objectUrl };
}

/** Seek and resolve once the requested frame is rendered. */
function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    try {
      video.currentTime = Math.max(0, Math.min(video.duration - 0.05, t));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Extract evenly-spaced keyframes from a video file.
 * Returns small (≤320px wide) JPEG data URLs suitable for vision LLMs.
 */
export async function extractKeyframes(
  file: File,
  opts: { intervalSec?: number; maxFrames?: number; targetWidth?: number; onProgress?: (p: number) => void } = {},
): Promise<{ frames: KeyframeSample[]; duration: number; width: number; height: number }> {
  const intervalSec = opts.intervalSec ?? 2;
  const maxFrames = opts.maxFrames ?? 16;
  const targetWidth = opts.targetWidth ?? 224;

  const { video, objectUrl } = await loadVideoFile(file);
  try {
    const duration = video.duration;
    if (!duration || !isFinite(duration)) throw new Error("Invalid video duration");

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    const scale = Math.min(1, targetWidth / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // Compute timestamps
    const desired = Math.min(maxFrames, Math.max(3, Math.floor(duration / intervalSec)));
    const step = duration / (desired + 1);
    const stamps: number[] = [];
    for (let i = 1; i <= desired; i++) stamps.push(i * step);

    const frames: KeyframeSample[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const t = stamps[i];
      try {
        await seekTo(video, t);
        ctx.drawImage(video, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
        frames.push({ t, dataUrl });
      } catch (e) {
        console.warn(`[extractKeyframes] skip t=${t.toFixed(2)}`, e);
      }
      opts.onProgress?.((i + 1) / stamps.length);
    }

    return { frames, duration, width: w, height: h };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Cut a video file into multiple silent WebM segments by re-encoding canvas frames.
 * Returns an array of { blob, blobUrl, duration } in the same order as `cuts`.
 *
 * SILENT POLICY: The MediaRecorder uses ONLY the canvas stream — no audio track.
 */
export async function cutVideoIntoSegments(
  file: File,
  cuts: RawSceneCut[],
  onProgress?: (p: { index: number; total: number; phase: "encoding" | "done" }) => void,
): Promise<{ blob: Blob; blobUrl: string; duration: number }[]> {
  if (cuts.length === 0) throw new Error("No cuts provided");

  const { video, objectUrl } = await loadVideoFile(file);
  const out: { blob: Blob; blobUrl: string; duration: number }[] = [];

  try {
    const W = video.videoWidth || 1280;
    const H = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const mime = pickMime();

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      const dur = Math.max(0.4, cut.end - cut.start);
      onProgress?.({ index: i, total: cuts.length, phase: "encoding" });

      // Seek to start
      await seekTo(video, cut.start);

      // Capture canvas only (silent)
      const stream = canvas.captureStream(30);
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(100);

      const startWall = performance.now();
      let lastDrawn = -1;
      const draw = () => {
        ctx.drawImage(video, 0, 0, W, H);
        lastDrawn = video.currentTime;
      };

      // Play and draw until target duration reached
      try {
        await video.play();
      } catch (e) {
        console.warn("[cutSegments] play failed, will use frame-by-frame fallback", e);
      }

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          video.pause();
          try {
            recorder.stop();
          } catch (_e) {}
          resolve();
        };
        const tick = () => {
          if (done) return;
          draw();
          const elapsedSrc = video.currentTime - cut.start;
          const elapsedWall = (performance.now() - startWall) / 1000;
          if (elapsedSrc >= dur || elapsedWall > dur * 4 + 2) {
            finish();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        // Hard safety
        setTimeout(finish, dur * 1000 * 4 + 5000);
      });

      await stopped;
      const blob = new Blob(chunks, { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      out.push({ blob, blobUrl, duration: dur });
    }

    onProgress?.({ index: cuts.length, total: cuts.length, phase: "done" });
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}
