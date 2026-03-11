

## Issues Identified

### 1. Only 8 seconds instead of 30 seconds
The multi-scene concat (`concatVideoBytes`) does raw byte-append of MP4 files, which produces a **corrupt file** — only the first clip plays. MP4 is not a concatenatable format; raw byte append creates an invalid container where players only read the first `moov` atom. So you got 4 scenes × 8s generated, but only the first 8s clip plays.

### 2. Logo not applied
The current approach appends text like *"Include a subtle watermark of the company logo in the bottom-right corner"* to the video prompt. Video generation models **cannot overlay an existing logo image** — they can only attempt to generate something that looks like a logo within the scene, which is unreliable and not your actual logo.

---

## Plan

### Fix 1: Multi-scene → Return individual clips instead of broken concat

Since proper MP4 muxing (ffmpeg) is not available in edge functions, the best approach is to **skip server-side concatenation** and instead return the individual scene clips to the client. The client can then either:
- Play them sequentially (auto-play next clip when one ends)
- Let the user download individual clips

**Changes:**
- **`generate-video/index.ts`** (`poll-multi` action, ~line 591-631): When all scenes complete, upload each clip individually to storage and return an array of URLs instead of attempting `concatVideoBytes`.
- **`VideoGeneratorDialog.tsx`**: Handle the array of scene URLs — display a sequential player that auto-advances through scenes, showing total combined duration.

### Fix 2: Real logo watermark via canvas compositing on client

Since video generation models cannot overlay your actual logo file, we need **post-generation compositing**. The approach:

- **`VideoGeneratorDialog.tsx`**: After video generation completes, if `brandKit.logo_url` exists, use a `<canvas>` + `<video>` element to draw each frame with the logo overlaid in the bottom-right corner, then export via `MediaRecorder` as a new MP4.
- **Remove the text-based logo prompt** (lines 334-336) since it doesn't work and wastes prompt tokens.
- Create a new utility `src/lib/videoWatermark.ts` that:
  1. Loads the video into a hidden `<video>` element
  2. Loads the logo image into an `<img>` element  
  3. Uses `canvas.captureStream()` + `MediaRecorder` to produce a watermarked MP4
  4. Returns a blob URL of the watermarked video

### Summary of file changes

| File | Change |
|------|--------|
| `supabase/functions/generate-video/index.ts` | `poll-multi`: upload clips individually, return `sceneUrls[]` array; remove `concatVideoBytes` |
| `src/lib/videoWatermark.ts` | New: canvas-based logo watermark compositing utility |
| `src/components/social/VideoGeneratorDialog.tsx` | Handle `sceneUrls[]` with sequential playback; apply watermark post-generation; remove text-based logo prompt |

### No database changes needed

