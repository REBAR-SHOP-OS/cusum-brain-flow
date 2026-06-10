/**
 * Instagram-safe video normalizer.
 *
 * Root-cause fix for "Publishing Failed: Instagram rejected this upload
 * during processing." Browser MediaRecorder produces MP4s with H.264 + AAC
 * that look correct to a codec probe but violate Instagram Reels' encoding
 * limits at the ENCODE level:
 *   - declared frame rate ~1000 fps (variable-frame-rate timestamps)
 *   - bitrate ~30 Mbps (over IG's 25 Mbps cap)
 *   - H.264 level 6.0 (IG accepts up to ~4.x)
 *
 * Facebook/LinkedIn tolerate this; Instagram does not. We re-encode any
 * non-conforming video to a strict, deterministic spec using WebCodecs +
 * mp4-muxer (no server-side ffmpeg required).
 *
 * Output spec (matches IG Reels recommendations):
 *   container : MP4 (moov at head, fastStart)
 *   video     : H.264 High profile, level 4.1, 30 fps CFR, ≤8 Mbps
 *   audio     : AAC-LC, 128 kbps, source sample rate (44.1 or 48 kHz)
 *
 * Safe to call on any input. If WebCodecs is unavailable or input cannot be
 * decoded, returns the original blob unchanged (existing server-side codec
 * probe + WebM guards remain the safety net).
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export const IG_SAFE_SPEC = {
  fps: 30,
  videoBitrate: 8_000_000, // 8 Mbps — well under IG's 25 Mbps ceiling
  audioBitrate: 128_000,
  codecVideo: "avc1.640029", // H.264 High @ Level 4.1
  codecAudio: "mp4a.40.2", // AAC-LC
} as const;

const MAX_DIMENSION = 1920; // IG hard cap on long edge

function webCodecsSupported(): boolean {
  return (
    typeof (globalThis as any).VideoEncoder !== "undefined" &&
    typeof (globalThis as any).AudioEncoder !== "undefined" &&
    typeof (globalThis as any).VideoDecoder !== "undefined"
  );
}

async function blobFromSource(src: Blob | string): Promise<Blob> {
  if (typeof src === "string") {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.blob();
  }
  return src;
}

/** Quick heuristic: input is small + short → probably fine, skip re-encode. */
async function isProbablyAlreadySafe(blob: Blob): Promise<boolean> {
  // A 19s/80MB browser-recorded MP4 is 4.2 MB/s = ~33 Mbps → fails.
  // A normal phone/IG-safe MP4 at 8 Mbps over 60s is ≤60 MB → ~1 MB/s.
  // Use ~1.6 MB/s (≈12.8 Mbps) as conservative "already safe" threshold.
  const SAFE_BYTES_PER_SECOND = 1_600_000;
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata load failed"));
      video.src = url;
    });
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) return false;
    const bps = blob.size / duration;
    return bps <= SAFE_BYTES_PER_SECOND;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface DecodedSource {
  video: HTMLVideoElement;
  width: number;
  height: number;
  duration: number;
  url: string;
}

async function loadDecodableVideo(blob: Blob): Promise<DecodedSource> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Video load failed"));
    video.src = url;
  });
  return {
    video,
    width: video.videoWidth,
    height: video.videoHeight,
    duration: video.duration,
    url,
  };
}

function scaleToCap(w: number, h: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= MAX_DIMENSION) {
    // round to even (H.264 requires even dimensions)
    return { width: w - (w % 2), height: h - (h % 2) };
  }
  const ratio = MAX_DIMENSION / long;
  const width = Math.round(w * ratio);
  const height = Math.round(h * ratio);
  return { width: width - (width % 2), height: height - (height % 2) };
}

async function reencodeWithWebCodecs(blob: Blob): Promise<Blob | null> {
  const src = await loadDecodableVideo(blob);
  const { width, height } = scaleToCap(src.width, src.height);
  const fps = IG_SAFE_SPEC.fps;
  const totalFrames = Math.max(1, Math.floor(src.duration * fps));

  // ── Audio capture via WebAudio (offline render of the same blob) ──
  let audioBuffer: AudioBuffer | null = null;
  try {
    const arrayBuf = await blob.arrayBuffer();
    const tmpCtx = new AudioContext();
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuf.slice(0));
    await tmpCtx.close();
  } catch {
    audioBuffer = null; // silent video — IG accepts it
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: "in-memory",
    video: {
      codec: "avc",
      width,
      height,
      frameRate: fps,
    },
    audio: audioBuffer
      ? {
          codec: "aac",
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
        }
      : undefined,
  });

  // ── Video encoder ──
  const VEncoder = (globalThis as any).VideoEncoder;
  const videoEncoder = new VEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: Error) => {
      throw e;
    },
  });
  videoEncoder.configure({
    codec: IG_SAFE_SPEC.codecVideo,
    width,
    height,
    bitrate: IG_SAFE_SPEC.videoBitrate,
    framerate: fps,
    avc: { format: "avc" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const VideoFrameCtor = (globalThis as any).VideoFrame;

  src.video.currentTime = 0;
  await new Promise<void>((r) => {
    src.video.onseeked = () => r();
  });

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    await new Promise<void>((resolve) => {
      src.video.onseeked = () => resolve();
      src.video.currentTime = Math.min(t, src.duration - 0.0001);
    });
    ctx.drawImage(src.video, 0, 0, width, height);
    const frame = new VideoFrameCtor(canvas, {
      timestamp: Math.round((i * 1_000_000) / fps),
      duration: Math.round(1_000_000 / fps),
    });
    const keyFrame = i % (fps * 2) === 0; // keyframe every 2s
    videoEncoder.encode(frame, { keyFrame });
    frame.close();
  }
  await videoEncoder.flush();
  videoEncoder.close();

  // ── Audio encoder ──
  if (audioBuffer) {
    const AEncoder = (globalThis as any).AudioEncoder;
    const audioEncoder = new AEncoder({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: Error) => {
        throw e;
      },
    });
    audioEncoder.configure({
      codec: IG_SAFE_SPEC.codecAudio,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
      bitrate: IG_SAFE_SPEC.audioBitrate,
    });

    const channels = Math.min(2, audioBuffer.numberOfChannels);
    const length = audioBuffer.length;
    // Interleaved Float32 PCM
    const interleaved = new Float32Array(length * channels);
    const chData: Float32Array[] = [];
    for (let c = 0; c < channels; c++) chData.push(audioBuffer.getChannelData(c));
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < channels; c++) {
        interleaved[i * channels + c] = chData[c][i];
      }
    }
    const AudioDataCtor = (globalThis as any).AudioData;
    const audioData = new AudioDataCtor({
      format: "f32",
      sampleRate: audioBuffer.sampleRate,
      numberOfFrames: length,
      numberOfChannels: channels,
      timestamp: 0,
      data: interleaved,
    });
    audioEncoder.encode(audioData);
    audioData.close();
    await audioEncoder.flush();
    audioEncoder.close();
  }

  muxer.finalize();
  URL.revokeObjectURL(src.url);
  const { buffer } = (muxer.target as ArrayBufferTarget);
  return new Blob([buffer], { type: "video/mp4" });
}

export interface NormalizeResult {
  blob: Blob;
  reencoded: boolean;
  reason?: string;
}

/**
 * Returns an Instagram-safe MP4. If the input already meets the spec
 * (or WebCodecs/decode is unavailable) returns the original blob.
 */
export async function normalizeForInstagram(
  source: Blob | string,
): Promise<NormalizeResult> {
  const original = await blobFromSource(source);

  if (!webCodecsSupported()) {
    return { blob: original, reencoded: false, reason: "webcodecs_unavailable" };
  }

  if (await isProbablyAlreadySafe(original)) {
    return { blob: original, reencoded: false, reason: "already_safe" };
  }

  try {
    const out = await reencodeWithWebCodecs(original);
    if (!out) return { blob: original, reencoded: false, reason: "encoder_no_output" };
    return { blob: out, reencoded: true };
  } catch (err: any) {
    console.warn("[igSafeVideo] re-encode failed, using original:", err?.message || err);
    return { blob: original, reencoded: false, reason: `encode_error:${err?.message || "unknown"}` };
  }
}
