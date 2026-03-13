

# First & Last Frame Image Upload for Veo 3.1

## Overview
Add two separate image upload slots — "First Frame" and "Last Frame" — to the Video Studio prompt bar. When provided, these images are sent to the Veo 3.1 API as `image` and `lastFrame` parameters, enabling image-to-video generation where the video starts from one image and ends at another.

## Changes

### 1. `src/components/social/VideoStudioPromptBar.tsx`
- Add two new props: `firstFrameImage`, `lastFrameImage`, `onFirstFrameChange`, `onLastFrameChange`
- Replace the single "Ref image" button with two distinct upload buttons:
  - **📷 First Frame** — thumbnail preview when uploaded, click to change/remove
  - **📷 Last Frame** — same UX
- Add two hidden file inputs with separate refs
- Show small thumbnail previews (32x32 rounded) inline when images are uploaded
- Both visible when `mediaType === "video"` (not limited to I2V models — works with Veo too)

### 2. `src/components/social/VideoStudioContent.tsx`
- Add two new state variables: `firstFrameImage` and `lastFrameImage` (base64 or blob URLs)
- Pass them to `VideoStudioPromptBar`
- In `handleGenerate`:
  - Upload both images to storage (like existing `referenceImage` logic)
  - For Veo provider: fetch each image as base64 and pass `firstFrameImageBase64` and `lastFrameImageBase64` to the edge function
  - For Wan I2V: use `firstFrameImage` as the existing `imageUrl` parameter

### 3. `supabase/functions/generate-video/index.ts`
- Accept new parameters: `firstFrameBase64`, `lastFrameBase64`, `firstFrameMimeType`, `lastFrameMimeType`
- Update `veoGenerate()` to accept optional first/last frame data
- When provided, add to the `instances[0]` object:
  ```json
  {
    "prompt": "...",
    "image": { "bytesBase64Encoded": "...", "mimeType": "image/jpeg" },
    "lastFrame": { "bytesBase64Encoded": "...", "mimeType": "image/jpeg" }
  }
  ```
- Note: `lastFrame` has NO nested `image` wrapper (Gemini API requirement)
- Update the Zod schema to accept these optional string fields

### Files
- `src/components/social/VideoStudioPromptBar.tsx`
- `src/components/social/VideoStudioContent.tsx`
- `supabase/functions/generate-video/index.ts`

