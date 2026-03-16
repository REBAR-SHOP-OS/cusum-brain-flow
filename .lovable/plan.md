

# Fix: Instagram Video Publishing Timeout

## Problem
The `social-publish` edge function times out when publishing video content (Reels) to Instagram. The current polling loop (line 366-379) tries 10 times with 2-second intervals (20 seconds total). Video/Reels processing on Instagram often takes 30-60+ seconds, so the poll exhausts before the media is ready.

The affected post has a `.mp4` URL, confirming it's a video upload.

## Changes

### `supabase/functions/social-publish/index.ts`
In the `publishToInstagram` function:
- For **video/reels**: increase polling to 30 attempts with 3-second intervals (90 seconds max)
- For **images**: keep current 10 attempts with 2-second intervals (sufficient)
- Add logging to track polling progress

```
// Current (line 366):
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 2000));

// New:
const maxPolls = isVideo ? 30 : 10;
const pollInterval = isVideo ? 3000 : 2000;
for (let i = 0; i < maxPolls; i++) {
  await new Promise((r) => setTimeout(r, pollInterval));
```

This requires passing `isVideo` into the `publishToInstagram` function as a parameter.

## Technical Note
Edge functions have a wall-clock limit but the polling approach with `fetch` calls (not CPU-intensive) should stay within limits. The 90-second window covers most Instagram video processing scenarios.

