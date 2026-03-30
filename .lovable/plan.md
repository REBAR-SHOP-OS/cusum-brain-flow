

# Fix Download for ZIP Files & Add Download to All File Types

## Problem
1. **ZIP file download fails**: `downloadFile()` uses raw `fetch()` which can fail due to CORS on Supabase storage URLs. No fallback proxy is provided for team chat files, so it falls back to opening a new tab.
2. **Audio files have no download button**: The audio attachment renderer (lines 727-734) only shows an audio player — no download option.

## Root Cause
- `directDownload()` does a cross-origin `fetch()` on Supabase storage URLs. If CORS headers aren't set or the browser blocks opaque responses, the download fails silently and falls to "open in new tab" fallback.
- For Supabase storage files, the proper approach is to use an `<a>` tag with the direct public URL + `download` attribute, or fetch with proper CORS mode.

## Changes

### 1. `src/lib/downloadUtils.ts`
- Add a **Supabase storage-aware download path**: detect if URL is from our Supabase storage and use `<a href="..." download>` with `target="_blank"` approach instead of `fetch()` for these URLs
- For storage URLs, construct a download-friendly URL or use the anchor tag directly since the file is publicly accessible

### 2. `src/components/teamhub/MessageThread.tsx`
- **Add download button to audio attachments** (lines 727-734): Add the same download button pattern used for images and videos
- Ensure all attachment types consistently show a download action

## Technical Detail

```text
Current flow:
  downloadFile(url) → fetch(url) → CORS fail → open new tab

Fixed flow:
  downloadFile(url) → detect supabase storage URL →
    create <a> with href + download attr → click → download triggers
    (bypasses fetch CORS by using native browser download)
```

The key insight: `<a href="..." download="filename">` works for same-origin and CORS-allowed URLs. For Supabase public bucket URLs, adding `?download=` query param or using the anchor approach directly should work. If fetch still fails, we construct the anchor with the raw URL instead of creating a blob URL.

