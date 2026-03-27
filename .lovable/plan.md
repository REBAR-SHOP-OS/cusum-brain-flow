

# Always-Enabled Download Button

## Problem
The Download button in the ProVideoEditor toolbar is disabled (`disabled={!finalVideoUrl}`) when there's no stitched final video. The user wants to download the current video (even a single scene clip) at any time.

## Solution
In `src/components/ad-director/ProVideoEditor.tsx` (~line 1422-1437):

1. **Remove `disabled={!finalVideoUrl}`** — button is always clickable
2. **Use `videoSrc` as fallback** — download `finalVideoUrl` if available, otherwise download the current scene's video (`videoSrc` which is `selectedClip?.videoUrl`)
3. **Use `downloadFile` utility** for robust downloading (handles CORS, proxy fallback) instead of raw `<a>` click

```tsx
// Change from:
disabled={!finalVideoUrl}
onClick={() => {
  if (!finalVideoUrl) return;
  const a = document.createElement("a");
  a.href = finalVideoUrl;
  a.download = `${brand.name || "video"}-ad.mp4`;
  a.click();
}}

// Change to:
onClick={() => {
  const url = finalVideoUrl || videoSrc;
  if (!url) return;
  const fname = `${brand.name || "video"}-ad.mp4`;
  downloadFile(url, fname, { provider: "wan" });
}}
```

If neither `finalVideoUrl` nor `videoSrc` exists, the button shows but does nothing (edge case: no video generated yet). A toast could optionally warn the user.

## Files changed
- `src/components/ad-director/ProVideoEditor.tsx` — remove disabled prop, use videoSrc fallback in download handler

