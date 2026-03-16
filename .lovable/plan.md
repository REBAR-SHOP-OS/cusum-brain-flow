

# Fix Instagram Publish: Invalid `media_type`

## Problem
Lines 330-333 send `media_type: "IMAGE"` for images and `media_type: "VIDEO"` for videos. Instagram Graph API does not accept either value.

## Fix in `supabase/functions/social-publish/index.ts` (lines 328-339)

1. **Detect video via HEAD request** before building the container body — check content-type as fallback for URLs without clear extensions
2. **Image posts**: Omit `media_type` entirely, just send `image_url`, `caption`, `access_token`
3. **Video posts**: Use `media_type: "REELS"` with `video_url`

```typescript
// Detect video: check extension first, then HEAD content-type
let isVideo = /\.(mp4|mov|avi|wmv|webm)(\?|$)/i.test(imageUrl);
if (!isVideo) {
  try {
    const head = await fetch(imageUrl, { method: "HEAD" });
    const ct = head.headers.get("content-type") || "";
    isVideo = ct.startsWith("video/");
  } catch {}
}

const containerBody: Record<string, string> = {
  caption,
  access_token: accessToken,
};
if (isVideo) {
  containerBody.media_type = "REELS";
  containerBody.video_url = imageUrl;
} else {
  containerBody.image_url = imageUrl;
}
```

No other files need changes.

