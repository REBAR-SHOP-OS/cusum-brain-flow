// ISO BMFF (MP4/MOV) probe for Instagram-readiness gating.
//
// Why this exists: Instagram Reels requires a *real* H.264 (avc1) + AAC (mp4a)
// MP4. A file may be named `.mp4` and served as `video/mp4` while its inner
// codecs are HEVC (hev1/hvc1), VP9 (vp09), AV1 (av01), or have no audio track
// at all. Those uploads pass our old extension/MIME gate, get accepted into a
// Graph API container, and then get rejected during processing with the
// generic "Instagram Reels require a real MP4 video encoded as H.264 with AAC
// audio" message. By parsing the ftyp + moov atoms before publishing we can
// reject these files up-front with a clear, actionable error.
//
// Behavior is intentionally conservative: any parse failure → `unknown` codec
// → `isInstagramReady = false`. The caller decides whether `unknown` should
// block or allow.

export type VideoProbeResult = {
  videoCodec: string | "unknown";
  audioCodec: string | "unknown" | "none";
  container: string | "unknown";
  /** True only when we POSITIVELY identified avc1 + mp4a. */
  isInstagramReady: boolean;
  /** Human-readable reason when not ready (or "ok"). */
  reason: string;
  /** Did we ever locate a moov atom to inspect? */
  inspected: boolean;
};

type Box = { type: string; start: number; size: number; bodyStart: number; bodyEnd: number };

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function boxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

/** Walk top-level boxes starting at `start` within `bytes`. Stops at EOF or bad size. */
function* walkBoxes(bytes: Uint8Array, start = 0, end = bytes.length): Generator<Box> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = start;
  while (cursor + 8 <= end) {
    let size = readUint32(view, cursor);
    const type = boxType(bytes, cursor + 4);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit largesize — we don't need to follow huge boxes for codec sniff
      if (cursor + 16 > end) return;
      const hi = readUint32(view, cursor + 8);
      const lo = readUint32(view, cursor + 12);
      size = hi * 0x100000000 + lo;
      headerSize = 16;
    } else if (size === 0) {
      // box extends to EOF
      size = end - cursor;
    }
    if (size < headerSize || cursor + size > end) return;
    yield { type, start: cursor, size, bodyStart: cursor + headerSize, bodyEnd: cursor + size };
    cursor += size;
  }
}

function findBox(bytes: Uint8Array, type: string, start = 0, end = bytes.length): Box | null {
  for (const box of walkBoxes(bytes, start, end)) {
    if (box.type === type) return box;
  }
  return null;
}

/** Recursively find first descendant of given type within `parent`. */
function findDescendant(bytes: Uint8Array, type: string, parent: Box): Box | null {
  for (const box of walkBoxes(bytes, parent.bodyStart, parent.bodyEnd)) {
    if (box.type === type) return box;
    const nested = findDescendant(bytes, type, box);
    if (nested) return nested;
  }
  return null;
}

/** Find all `trak` boxes inside `moov`. */
function findTraks(bytes: Uint8Array, moov: Box): Box[] {
  const traks: Box[] = [];
  for (const box of walkBoxes(bytes, moov.bodyStart, moov.bodyEnd)) {
    if (box.type === "trak") traks.push(box);
  }
  return traks;
}

/** For a `trak`, read handler type ("vide"|"soun"|...) and first sample-entry codec FourCC. */
function inspectTrak(bytes: Uint8Array, trak: Box): { handler: string; codec: string } | null {
  const mdia = findDescendant(bytes, "mdia", trak);
  if (!mdia) return null;
  const hdlr = findDescendant(bytes, "hdlr", mdia);
  let handler = "";
  if (hdlr) {
    // hdlr layout: version(1) + flags(3) + pre_defined(4) + handler_type(4)
    const handlerOffset = hdlr.bodyStart + 8;
    if (handlerOffset + 4 <= hdlr.bodyEnd) {
      handler = boxType(bytes, handlerOffset);
    }
  }
  const stsd = findDescendant(bytes, "stsd", mdia);
  let codec = "";
  if (stsd) {
    // stsd layout: version(1)+flags(3)+entry_count(4)+entries...
    // first entry: size(4)+format(4)+...
    const entriesStart = stsd.bodyStart + 8;
    if (entriesStart + 8 <= stsd.bodyEnd) {
      codec = boxType(bytes, entriesStart + 4);
    }
  }
  return { handler, codec };
}

async function fetchRange(url: string, rangeHeader: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { headers: { Range: rangeHeader } });
    if (!res.ok && res.status !== 206) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

const VIDEO_CODECS_INSTAGRAM_OK = new Set(["avc1", "avc3"]);
const AUDIO_CODECS_INSTAGRAM_OK = new Set(["mp4a"]);

export async function probeVideoForInstagram(url: string): Promise<VideoProbeResult> {
  // Try the head of the file first (faststart MP4s put moov up front).
  let head = await fetchRange(url, "bytes=0-524287"); // 512 KB
  if (!head) {
    return {
      videoCodec: "unknown",
      audioCodec: "unknown",
      container: "unknown",
      isInstagramReady: false,
      reason: "probe_failed_fetch",
      inspected: false,
    };
  }

  const ftyp = findBox(head, "ftyp");
  let container = "unknown";
  if (ftyp && ftyp.bodyStart + 4 <= ftyp.bodyEnd) {
    container = boxType(head, ftyp.bodyStart);
  }

  let moov = findBox(head, "moov");
  if (!moov) {
    // moov may be at end (non-faststart). Grab the tail.
    const tail = await fetchRange(url, "bytes=-1048576"); // last 1 MB
    if (tail) {
      const merged = new Uint8Array(head.length + tail.length);
      merged.set(head, 0);
      merged.set(tail, head.length);
      head = merged;
      moov = findBox(head, "moov", head.length - tail.length);
      if (!moov) moov = findBox(head, "moov");
    }
  }

  if (!moov) {
    return {
      videoCodec: "unknown",
      audioCodec: "unknown",
      container,
      isInstagramReady: false,
      reason: "moov_not_found",
      inspected: false,
    };
  }

  const traks = findTraks(head, moov);
  let videoCodec: VideoProbeResult["videoCodec"] = "unknown";
  let audioCodec: VideoProbeResult["audioCodec"] = "none";
  for (const trak of traks) {
    const info = inspectTrak(head, trak);
    if (!info) continue;
    if (info.handler === "vide" && videoCodec === "unknown" && info.codec) {
      videoCodec = info.codec;
    } else if (info.handler === "soun" && audioCodec !== "mp4a" && info.codec) {
      audioCodec = info.codec;
    }
  }

  const videoOk = typeof videoCodec === "string" && VIDEO_CODECS_INSTAGRAM_OK.has(videoCodec);
  const audioOk = typeof audioCodec === "string" && AUDIO_CODECS_INSTAGRAM_OK.has(audioCodec);

  let reason = "ok";
  if (!videoOk && !audioOk) reason = `bad_codecs:${videoCodec}/${audioCodec}`;
  else if (!videoOk) reason = `bad_video_codec:${videoCodec}`;
  else if (!audioOk) reason = audioCodec === "none" ? "missing_audio_track" : `bad_audio_codec:${audioCodec}`;

  return {
    videoCodec,
    audioCodec,
    container,
    isInstagramReady: videoOk && audioOk,
    reason,
    inspected: true,
  };
}

/** Friendly one-line description of why a probe failed Instagram-readiness. */
export function describeProbeFailure(probe: VideoProbeResult): string {
  if (probe.isInstagramReady) return "";
  if (!probe.inspected) {
    return "Could not verify video codecs (file metadata unreadable). Re-export as MP4 (H.264 + AAC) and try again.";
  }
  if (probe.audioCodec === "none") {
    return "Video has no audio track. Instagram Reels require an AAC audio track — re-render with silent AAC audio at minimum.";
  }
  if (probe.videoCodec !== "unknown" && !VIDEO_CODECS_INSTAGRAM_OK.has(probe.videoCodec)) {
    return `Video codec "${probe.videoCodec}" is not accepted by Instagram. Re-render as H.264 (avc1) MP4.`;
  }
  if (probe.audioCodec !== "unknown" && !AUDIO_CODECS_INSTAGRAM_OK.has(probe.audioCodec as string)) {
    return `Audio codec "${probe.audioCodec}" is not accepted by Instagram. Re-render with AAC audio.`;
  }
  return "Video is not Instagram-ready. Re-render as MP4 (H.264 + AAC) and try again.";
}
