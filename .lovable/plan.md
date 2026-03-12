

# Fix: Export Fails — "Output video has invalid duration: Infinity"

## Root Cause

WebM blobs produced by `MediaRecorder` often lack duration metadata in their headers. When the validation step creates a `<video>` element and reads `testVideo.duration`, the browser returns `Infinity` because the WebM container doesn't include a seekable duration field. The `validateBlob` function then rejects the blob as invalid.

The actual video content is fine — all 7 clips stitch successfully (console logs confirm `cumTime=30.00s`). The problem is purely in the validation check.

## Fix

### `src/lib/videoStitch.ts` — Pass known duration to validation, accept Infinity

Two changes:

1. **Track cumulative duration** and pass it to `validateBlob` as `expectedDuration`. If the blob reports `Infinity` but we have a known expected duration > 0, treat it as valid and use the expected duration instead.

2. **Update `validateBlob` signature** to accept an optional `expectedDuration` parameter:

```text
Before:  if (!dur || dur <= 0 || !isFinite(dur)) → REJECT

After:   if (!dur || dur <= 0) → REJECT
         if (!isFinite(dur) && expectedDuration > 0) → ACCEPT with expectedDuration
         if (!isFinite(dur)) → REJECT
```

### In `recorder.onstop`

Pass `cumulativeTime` (which equals 30.00s from the logs) to `validateBlob`:

```text
const validation = await validateBlob(blob, cumulativeTime);
```

This is a one-file, ~5-line change. No other files affected.

## Files
- `src/lib/videoStitch.ts` — update `validateBlob` to handle `Infinity` duration with fallback to known cumulative time

