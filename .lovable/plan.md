

# Auto-Retry Failed Scenes in Video Generation Pipeline

## Problem
When video generation for a scene fails (API error, polling timeout, provider capacity), the clip is marked `status: "failed"` and **no retry is attempted**. The pipeline proceeds to export with only completed clips, resulting in cards without videos.

Failure points include:
- Wan API returning errors or timing out during polling (120 attempts × 3-5s = ~8 min max)
- Provider capacity errors (rate limits, quota)
- Network errors during polling (3 consecutive errors → fail)
- "No video URL returned" from the edge function

## Solution
Add automatic retry logic for failed scenes before proceeding to export/stitch.

## Changes

### `src/lib/backgroundAdDirectorService.ts`

**1. Add retry loop after initial `Promise.allSettled`** (after line ~503):

After all scenes finish their first attempt, check for failed clips. For each failed clip, retry up to 2 more times with the same parameters. This happens before the export phase.

```
Logic:
- After Promise.allSettled(scenePromises):
  - Loop up to 2 retry rounds
  - Collect clips with status === "failed"
  - If none, break
  - For each failed clip, re-invoke generate-video + poll
  - Wait for all retries to settle
  - Check again
- Then proceed to export
```

**2. Add a small delay between retries** to avoid hitting rate limits (3-5 second pause per round).

**3. Update status text** during retry: `"Retrying failed scenes... attempt X/2"`

**4. Fallback provider on retry**: If the original provider failed, try a different provider on retry (e.g., wan failed → try veo if key available).

### No UI changes needed
The existing UI already shows failed states with retry buttons. This change ensures the pipeline itself retries automatically before declaring scenes as failed.

## Files Changed
- `src/lib/backgroundAdDirectorService.ts` — add retry loop after initial parallel generation, before export phase

