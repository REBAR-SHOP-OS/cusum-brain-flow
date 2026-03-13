

# Fix Veo 3.1 First/Last Frame API Format

## Problem
The video generated has nothing to do with uploaded first/last frame images because the API payload format is wrong. The current code sends:
```json
"image": { "bytesBase64Encoded": "...", "mimeType": "..." }
```

But the official Gemini REST API requires:
```json
"image": { "inlineData": { "mimeType": "image/png", "data": "BASE64" } }
"lastFrame": { "inlineData": { "mimeType": "image/png", "data": "BASE64" } }
```

Veo silently ignores the incorrectly formatted image data and generates a text-only video.

## Fix

### `supabase/functions/generate-video/index.ts` — `veoGenerate()` (lines 72-88)

Change the image payload structure from:
```typescript
instance.image = {
  bytesBase64Encoded: firstFrameBase64,
  mimeType: firstFrameMimeType || "image/jpeg",
};
instance.lastFrame = {
  bytesBase64Encoded: lastFrameBase64,
  mimeType: lastFrameMimeType || "image/jpeg",
};
```

To the correct format:
```typescript
instance.image = {
  inlineData: {
    mimeType: firstFrameMimeType || "image/jpeg",
    data: firstFrameBase64,
  },
};
instance.lastFrame = {
  inlineData: {
    mimeType: lastFrameMimeType || "image/jpeg",
    data: lastFrameBase64,
  },
};
```

### File
- `supabase/functions/generate-video/index.ts` — single change in `veoGenerate()` function

