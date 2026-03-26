

# Fix Video History: Videos Not Displaying

## Root Cause
The `final_video_url` saved to the database is a **blob URL** (`blob:https://...`). Blob URLs are temporary — they only work within the browser session that created them. When the page reloads or opens in a new session, the blob URL is invalid and the `<video>` element fails silently, showing a gray/empty box.

## Solution
Upload the final stitched video to Supabase Storage before saving the project, then store the **permanent public URL** in the database.

## Changes

### 1. `src/components/ad-director/AdDirectorContent.tsx`
After `stitchClips` returns the blob (line ~170), **upload the blob to storage** before saving:
- Fetch the blob from `finalUrl.blobUrl`
- Upload to `generated-videos` bucket with path `{userId}/{uuid}.webm`
- Get the public URL
- Use the **public URL** (not blob URL) when calling `saveProject` with `finalVideoUrl`
- Still set blob URL in local state for immediate playback

### 2. `src/lib/backgroundAdDirectorService.ts` (line ~489)
Same fix for the service's internal export: after stitching, upload the blob to storage and store the permanent URL.

### 3. `src/components/ad-director/VideoHistory.tsx`
Add error handling to the `<video>` element:
- Add `onError` handler to show a fallback state (broken video icon)
- Add `crossOrigin="anonymous"` attribute for CORS
- Show a visual indicator when video can't be loaded

### 4. Migration: Regenerate signed URLs for existing blob URLs
Add a check in `VideoHistory`: if `final_video_url` starts with `blob:`, skip showing that project (since the blob is irrecoverable).

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Upload final video blob to storage, save permanent URL |
| `backgroundAdDirectorService.ts` | Same upload logic in service export |
| `VideoHistory.tsx` | Filter out invalid blob URLs, add video error handling |

