## Problem
WebM video uploads get stuck on "Uploading media…" indefinitely. The file picker now accepts `.webm`, but `uploadSocialMediaAsset` always pipes videos through `normalizeForInstagram` (in `src/lib/igSafeVideo.ts`), which:

1. Loads the WebM into an `HTMLVideoElement` and re-seeks once per output frame (30 fps × N seconds).
2. On WebM/VP9, `onseeked` is unreliable per-frame in Chromium — the loop can stall forever on a single seek, so the upload never finishes and no error is thrown.
3. There is no timeout wrapping the call, so the UI sits on "Uploading media…" forever.

## Fix (minimal, surgical)

**`src/lib/igSafeVideo.ts`** — early-return for WebM inputs:
- In `normalizeForInstagram`, after `blobFromSource`, check `original.type`. If it includes `"webm"`, return `{ blob: original, reencoded: false, reason: "webm_passthrough" }`.
- Rationale: WebM cannot be served to Instagram anyway; the publish-time backend path already handles platform conversion. Uploading the original WebM unblocks the UI immediately.

**`src/lib/socialMediaStorage.ts`** — defensive timeout around normalization:
- Wrap the `normalizeForInstagram(blob)` call in a `Promise.race` with a 45s timeout.
- On timeout: log a warning and continue with the original blob (same path the existing `catch` already takes). This prevents future hangs on any other codec, not just WebM.

No backend changes. No UI changes. No new dependencies.

## Files touched
- `src/lib/igSafeVideo.ts` — 3-line guard at the top of `normalizeForInstagram`.
- `src/lib/socialMediaStorage.ts` — wrap the normalize call in a timeout race.

## Verification
- Upload a `.webm` from the post panel → should land in storage within seconds and the "Uploading media…" overlay disappears.
- Upload an `.mp4` recorded in-browser → still goes through the IG-safe re-encode path (unchanged behavior).
