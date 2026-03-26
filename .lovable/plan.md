

# Fix Scene Regeneration — Missing Polling Logic

## Problem
When regenerating a scene with a custom prompt, the video never appears. The root cause: `handleRegenerateScene` in `AdDirectorContent.tsx` sends the generation request but **only handles synchronous video URL responses**. The Wan API returns `{ jobId, provider, status: "pending" }` (async), requiring polling — but the regeneration code has no polling logic. The clip stays stuck in "generating" forever.

Compare:
- **Main pipeline** (line 416-418): checks for `jobId` → calls `pollGeneration()` ✅
- **Regeneration handler** (line 309-314): only checks for `videoUrl` → no polling ❌

## Fix

### `src/components/ad-director/AdDirectorContent.tsx` — `handleRegenerateScene` (lines 301-319)

Add the missing polling branch after checking for `videoUrl`. If no immediate URL but a `jobId` is returned, poll the `generate-video` edge function until the video completes, fails, or times out.

```tsx
// After getting result from invokeEdgeFunction:
const videoUrl = result.url || result.videoUrl;
const genId = result.jobId;
const provider = result.provider || "wan";

if (videoUrl) {
  // Immediate URL — update clip as completed
  service.patchState({ clips: ... });
} else if (genId) {
  // Async job — poll until complete (same pattern as main pipeline)
  const maxAttempts = 120;
  let consecutiveErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollResult = await invokeEdgeFunction("generate-video", {
      action: "poll", jobId: genId, provider
    });
    if (pollResult.status === "completed" || pollResult.videoUrl || pollResult.url) {
      // Update clip with video URL
      break;
    }
    if (pollResult.status === "failed") {
      // Mark clip as failed
      break;
    }
    // Update progress
  }
} else {
  // No URL and no jobId — mark failed
}
```

### `src/lib/backgroundAdDirectorService.ts` — No changes needed
The `pollGeneration` method is private. We replicate the polling logic inline in the component handler (it's straightforward) to avoid exposing private methods.

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Add polling logic to `handleRegenerateScene` for async Wan jobs |

