

# Fix: Face Memory Panel Empty + Recognition Intermittent Failures

## Root Causes Found

### BUG 1: FaceMemoryPanel queries non-existent column `storage_path`
**File:** `src/components/timeclock/FaceMemoryPanel.tsx` line 44
**Impact:** Memory panel always shows "0 people enrolled, 0 photos total"

The panel selects `storage_path` but the actual column in `face_enrollments` is `photo_url`. The query silently fails or returns empty, so no enrolled faces are ever displayed.

**Evidence:** Database has 20+ active enrollments across 6 profiles — but the panel shows zero.

### BUG 2: Signed URLs break AI recognition ~50% of the time
**File:** `supabase/functions/face-recognize/index.ts` lines 76-95
**Impact:** "Cannot fetch content from the provided URL" error causes face scan to fail, showing "First Time Here?" even for enrolled users

The edge function generates Supabase signed URLs for reference photos and passes them as `image_url` to Gemini. But Gemini's servers intermittently cannot fetch these URLs (network access, timing, or URL format issues). Logs show this error on 3 out of 5 recent scan attempts.

**Evidence from logs:**
- 12:55, 12:56, 12:59 → `"Cannot fetch content from the provided URL"` → recognition fails → shows "First Time Here?"
- 12:54, 13:01 → works fine → matched Radin at 98% confidence

### BUG 3: Signed URL generation also fails in FaceMemoryPanel thumbnails
The panel uses `item.storage_path` (undefined due to BUG 1) to generate signed URLs for thumbnails — double failure.

## Fixes

### Fix 1: Correct column name in FaceMemoryPanel
Change `storage_path` → `photo_url` in the select query and all references throughout the component.

### Fix 2: Convert reference photos to base64 instead of signed URLs
In `face-recognize/index.ts`, download each reference photo from storage and convert to base64 data URLs (same format as the captured photo). This eliminates the external URL dependency entirely — Gemini receives all images as inline base64 data.

```
Before: { type: "image_url", image_url: { url: signedUrl } }
After:  { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
```

This is the same pattern already used for the captured photo (line 148) and is 100% reliable.

### Fix 3: Fix thumbnail generation in FaceMemoryPanel
Use the corrected `photo_url` field for signed URL generation in the memory panel thumbnails.

## Files to Change
- `src/components/timeclock/FaceMemoryPanel.tsx` — fix column name `storage_path` → `photo_url`
- `supabase/functions/face-recognize/index.ts` — download + base64 encode reference photos instead of signed URLs

## Expected Result
- Memory panel shows all enrolled people with photo thumbnails
- Face recognition works reliably every time (no more URL fetch failures)
- "First Time Here?" only appears for genuinely unrecognized faces

