

# Fix: "Clip 1 failed to load" during Export

## Root Cause

The `fetchAsBlob()` helper in `videoStitch.ts` silently falls back to the original URL when the fetch fails (CORS). The video element is then created with `crossOrigin = "anonymous"`, which causes the browser to enforce CORS on the original URL — and it fails because the source (DashScope CDN or similar) doesn't send `Access-Control-Allow-Origin` headers.

The irony: `fetchAsBlob` was designed to avoid CORS by converting to a blob URL, but its error handler returns the raw URL, which then fails harder because `crossOrigin` is set.

## Fix

### File: `src/lib/videoStitch.ts`

1. **Remove `crossOrigin = "anonymous"` from video elements in `preloadAndValidate`** — it's not needed when using blob URLs, and it breaks when falling back to raw URLs. The canvas will be "tainted" (can't extract pixels) but that's irrelevant since we use `captureStream()` not `toDataURL()`.

2. **Improve `fetchAsBlob` to retry with a no-cors proxy fallback** — if the direct fetch fails, try without CORS mode (opaque response won't work for blob), so instead just log the warning and return the original URL without crossOrigin.

3. **Remove `crossOrigin` from the video element entirely** — `captureStream()` doesn't require an untainted canvas for recording (only `toBlob`/`toDataURL` do). This is the key insight: the current code unnecessarily sets `crossOrigin` which blocks playback of cross-origin videos.

### Specific Changes

In `preloadAndValidate` (line 169): Remove `v.crossOrigin = "anonymous"` — this single line is the root cause. Without it, the video will load and play fine from any URL (blob or raw), and `captureStream` + `MediaRecorder` still works.

Also improve `fetchAsBlob` to be more robust: add a second attempt with `mode: "no-cors"` awareness, and log clearly when falling back.

## Files Modified
1. `src/lib/videoStitch.ts` — Remove `crossOrigin` from video elements, improve fetchAsBlob error logging

