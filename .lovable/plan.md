

# Fix: Scenes Stuck at 0/6 — Field Name + Poll Action Mismatch

## Root Cause
Two mismatches between the `generate-video` edge function and the frontend:

1. **Field name**: Edge function returns `{ jobId: "..." }` but `generateScene()` checks for `result.generationId` — so polling is never started.
2. **Poll action**: Frontend sends `{ action: "status", generationId }` but edge function expects `{ action: "poll", jobId }`.
3. **Slideshow fallback not handled**: When all video providers are down, the edge function returns `{ status: "completed", mode: "slideshow", imageUrls: [...] }` but the frontend doesn't handle this case.

## Changes in `src/components/ad-director/AdDirectorContent.tsx`

### 1. Fix `generateScene` response handling (lines 284-316)
- Update the type to include `jobId`, `provider`, `mode`, `imageUrls`
- Check `result.jobId` instead of `result.generationId`
- Handle slideshow fallback (`mode: "slideshow"`) — treat imageUrls[0] as a static thumbnail with "completed" status

### 2. Fix `pollGeneration` to use correct action (lines 326-367)
- Change `{ action: "status", generationId }` to `{ action: "poll", jobId: generationId, provider: "wan" }`
- Handle poll response which returns `{ status, videoUrl }` from the `wanPoll` result

## Files Modified
- `src/components/ad-director/AdDirectorContent.tsx` — fix field names and poll action

