

# Fix: Facebook "Invalid parameter" Error for Video Posts

## Root Cause

The `publishToFacebook()` function in both `social-publish/index.ts` and `social-cron-publish/index.ts` only handles **text** and **photo** posts. When a video URL (e.g., `.mp4`) is passed, it sends it to `/{pageId}/photos` — Facebook's Photos API rejects video files with "Invalid parameter".

Instagram's `publishToInstagram()` already has proper video detection (URL extension check + HEAD request content-type check), but the Facebook function was never updated to handle videos.

```text
CURRENT (broken):
  publishToFacebook(pageId, token, message, videoUrl)
    → POST /{pageId}/photos  { url: videoUrl }  ← INVALID for video
    → Facebook returns: "Invalid parameter"

FIXED:
  publishToFacebook(pageId, token, message, videoUrl, contentType)
    → Detect video (extension + HEAD content-type)
    → POST /{pageId}/videos  { file_url: videoUrl, description: message }
    → Facebook processes video → success
```

## Changes

### File 1: `supabase/functions/social-publish/index.ts`

**1a.** Update `publishToFacebook` signature to accept `contentType` parameter, add video detection logic (same pattern as Instagram), and route to `/{pageId}/videos` for video content:

```typescript
async function publishToFacebook(
  pageId: string, accessToken: string, message: string, 
  imageUrl?: string, contentType: string = "post"
): Promise<{ id?: string; error?: string }> {
  // Detect video by URL extension + HEAD content-type
  let isVideo = false;
  if (imageUrl) {
    isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
    if (!isVideo) {
      try {
        const head = await fetch(imageUrl, { method: "HEAD" });
        const ct = head.headers.get("content-type") || "";
        isVideo = ct.startsWith("video/");
      } catch { /* ignore */ }
    }
  }
  // Route to correct endpoint
  if (imageUrl && isVideo) → /{pageId}/videos  (file_url + description)
  else if (imageUrl)       → /{pageId}/photos  (url + message)  
  else                     → /{pageId}/feed    (message only)
}
```

**1b.** Update the call site (line 344) to pass `content_type`:
```typescript
result = await publishToFacebook(pageId, pageAccessToken, message, image_url, content_type);
```

### File 2: `supabase/functions/social-cron-publish/index.ts`

Apply the identical changes to its `publishToFacebook` function (lines 502-527) and the call site (line 375), passing `post.content_type`.

## Impact
- 2 files changed (`social-publish/index.ts`, `social-cron-publish/index.ts`)
- Facebook videos now publish correctly via the `/videos` endpoint
- Photo and text-only posts remain unchanged
- No database or frontend changes

