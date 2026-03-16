

# Fix: Instagram Video Publishing Timeout (Root Cause)

## Problem Analysis

The screenshot error "Instagram media processing timed out. Try again." persists despite the previous fix to `social-publish`. Two root causes:

1. **`social-cron-publish` was never updated**: It still uses the old hardcoded 10 polls / 2s interval (20s max), which is far too short for video processing on Instagram. This affects all scheduled/automated publishing.

2. **Client-side timeout**: `usePublishPost.ts` uses `supabase.functions.invoke()` which can time out before the edge function's 90s polling window completes. Need to switch to raw `fetch` with a 120s timeout (matching `useAutoGenerate` pattern).

## Changes

### 1. `supabase/functions/social-cron-publish/index.ts` (lines 347-381)
Update `publishToInstagram` to match `social-publish`:
- Add video detection via URL extension + HEAD content-type check
- Set `maxPolls = 30` / `pollInterval = 3000` for videos (90s total)
- Keep 10/2000 for images
- Support `media_type: "REELS"` + `video_url` for video containers (currently only sends `image_url`)
- Add polling progress logging

### 2. `src/hooks/usePublishPost.ts`
Replace `supabase.functions.invoke()` with raw `fetch` + `AbortController` with 120s timeout (same pattern as `useAutoGenerate`). This ensures the client waits long enough for video processing to complete on the server.

### 3. Deploy both edge functions
Explicitly deploy `social-publish` and `social-cron-publish` to ensure latest code is live.

## Technical Detail
- Instagram video/Reels processing typically takes 30-60s
- Edge function wall-clock limit is 150s (sufficient for 90s polling)
- Current client-side SDK timeout causes premature abort before server finishes polling
- The `social-cron-publish` function currently doesn't distinguish between image and video at all -- sends everything as `image_url` which causes Instagram API to fail silently for videos

