/**
 * Pick the best MediaRecorder MIME type for downstream platforms.
 *
 * Instagram only accepts MP4 (H.264 + AAC). Browser-recorded WebM (VP9/Opus)
 * is rejected by Meta's IG Graph API with INSTAGRAM_VIDEO_SPEC_ERROR even
 * though the file plays fine in browsers and on Facebook/LinkedIn.
 *
 * Chrome 130+, Edge, and recent Safari can record MP4 directly via
 * MediaRecorder. We prefer those types and fall back to WebM only when no
 * MP4 codec string is supported. The fallback path still hits the existing
 * IG codec-probe block and shows the operator a clear error.
 *
 * Returns BOTH the chosen MIME type and the file extension so storage uploads
 * preserve the real format (see `extensionForBlob` in socialMediaStorage.ts).
 */
export interface RecorderMimeChoice {
  mimeType: string;
  extension: "mp4" | "webm";
  hasAudio: boolean;
}

const VIDEO_ONLY_CANDIDATES = [
  // MP4 first — Instagram-ready, recent Chromium/Safari.
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1",
  "video/mp4",
  // WebM fallback.
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const VIDEO_WITH_AUDIO_CANDIDATES = [
  // MP4 first — H.264 video + AAC audio is Instagram-ready.
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  // WebM fallback (VP9 + Opus).
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pick(candidates: string[]): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // ignore, try next
    }
  }
  return "video/webm";
}

export function pickRecorderMime(opts: { hasAudio: boolean }): RecorderMimeChoice {
  const mimeType = pick(opts.hasAudio ? VIDEO_WITH_AUDIO_CANDIDATES : VIDEO_ONLY_CANDIDATES);
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  return { mimeType, extension, hasAudio: opts.hasAudio };
}
