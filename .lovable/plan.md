

# Fix "Use in Post" — Upload Failed for Remote Video URLs

## Problem
When clicking "Use in Post", the video URL is passed to `handleMediaReady` → `uploadSocialMediaAsset`, which tries to `fetch()` the URL client-side. If the video URL is a remote URL (e.g., from Google Veo API) without CORS headers, the browser blocks the fetch with "Failed to fetch". This only fails for remote URLs — blob: URLs from watermarking or slideshow work fine.

## Solution
Modify `handleUseVideo` in `VideoStudioContent.tsx` to convert remote URLs to blob URLs before passing them to `onVideoReady`. The component already has a `proxyDownload` function and a `blobUrlRef` — but when watermarking fails or there's no brand kit, the raw remote URL is kept.

### `src/components/social/VideoStudioContent.tsx`

**Change `handleUseVideo` (line 560)** from a simple pass-through to:
1. If `videoUrl` is already a `blob:` or `data:` URL → pass directly (works fine)
2. If it's a remote `https:` URL → fetch it via the existing `proxyDownload`-style edge function call to get a blob, then pass the blob URL to `onVideoReady`

```ts
const handleUseVideo = async () => {
  if (!videoUrl || !onVideoReady) return;
  
  // blob: and data: URLs can be fetched client-side fine
  if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) {
    onVideoReady(videoUrl);
    return;
  }
  
  // Remote URL — proxy download to avoid CORS
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: "download", provider: "veo", videoUrl }),
    });
    
    if (!resp.ok) throw new Error("Proxy download failed");
    const blob = await resp.blob();
    onVideoReady(URL.createObjectURL(blob));
  } catch (err) {
    console.error("Use in post proxy failed, trying direct:", err);
    // Fallback: try passing directly (may work for some URLs)
    onVideoReady(videoUrl);
  }
};
```

### Files Changed
- `src/components/social/VideoStudioContent.tsx` (line 560 — replace `handleUseVideo`)

