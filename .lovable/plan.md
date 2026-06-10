# Fix: Instagram rejects videos during processing (root cause)

## Diagnosis (verified, not guessed)

I downloaded and probed the actual failed video (`videos/fcb2af66….mp4`). It is **not** the old WebM problem — it really is MP4 with H.264 + AAC, so the codec probe passes and the upload reaches Instagram. Instagram then rejects it **during processing** because the file violates its encoding limits:

| Property | This file | Instagram limit |
|---|---|---|
| Declared frame rate | **1000 fps** (browser MediaRecorder artifact) | 23–60 fps |
| Video bitrate | **~34 Mbps** (80 MB for 19 s) | max 25 Mbps |
| H.264 level | **6.0** | ≤ 4.x |

Browser `MediaRecorder` (used by the slideshow/merge/editor pipelines) produces variable-frame-rate MP4s with a 1000 Hz timestamp track, ignores the bitrate hint, and stamps level 6.0. Facebook/LinkedIn tolerate this; Instagram does not. The current error message ("not a real MP4") is misleading — it is a real MP4 with out-of-spec encoding.

There are no server-side ffmpeg credentials configured (the GCE pipeline falls back to browser), so the fix is a deterministic **client-side re-encode** using WebCodecs.

## Changes

1. **New `src/lib/igSafeVideo.ts`** — re-encodes any video blob/URL into an Instagram-safe MP4 using WebCodecs + the `mp4-muxer` package:
   - constant 30 fps, H.264 (high profile, level 4.1), bitrate capped ~8 Mbps
   - AAC-LC audio 128 kbps, 44.1/48 kHz
   - `fastStart` (moov at head)
   - Skips work if the source already passes spec checks; falls back gracefully if WebCodecs is unavailable.

2. **Normalize at the source** — wherever social video blobs are uploaded (slideshow, audio merge, Pro Editor export → `socialMediaStorage`), run the blob through `igSafeVideo` first so every stored social video is Instagram-ready from day one.

3. **Auto-heal on publish/retry** — in `usePublishPost`: when publishing a video to Instagram, if the file is out of spec (or a previous attempt failed with the spec error), download → re-encode → re-upload → persist the new URL on the post → publish. This fixes the existing failed card and all 6 pages with one "Retry Publishing" click.

4. **Accurate error message** — update the server-side spec error to name the real causes (frame rate / bitrate / level), not just "re-render as MP4".

5. **Regression test** — `tests/regression/social/ig-safe-video-normalization.test.ts` asserting the normalizer enforces 30 fps CFR / ≤8 Mbps / level 4.1 settings and that upload + retry paths call it.

## Technical notes

- `mp4-muxer` is a small, dependency-free muxer; WebCodecs H.264/AAC encoding is supported in Chrome/Edge (your environment).
- No backend changes other than the error-message wording; no new infrastructure or secrets needed.
- Dead-code rule honored: nothing replaced is left behind; existing probe/WebM guards stay (they catch a different failure class).
