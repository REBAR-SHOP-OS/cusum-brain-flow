

# Fix: Enforce Aspect Ratio on Generated Images

## Problem
When the user selects an aspect ratio (16:9, 1:1, 9:16), the generated image doesn't always match. The code already passes `aspect_ratio` to the AI gateway and includes prompt instructions, but the Gemini image models sometimes ignore these constraints and output images in arbitrary dimensions.

## Root Cause
The current approach relies on two soft signals:
1. A prompt instruction ("CRITICAL: Generate a LANDSCAPE image...")
2. An `aspect_ratio` field in the API request body

Neither guarantees the output image dimensions. The model may produce any shape.

## Solution: Server-Side Image Crop/Resize After Generation

Add a post-processing step in **both** `generatePixelImage` functions (in `ai-agent/index.ts` and `regenerate-post/index.ts`) and in `agentToolExecutor.ts` that:

1. After receiving the generated image (base64 data URL), decode it
2. Determine the target dimensions based on the selected aspect ratio
3. Use canvas-based cropping (center-crop to target ratio) via a Deno-compatible image library
4. Re-encode and upload the correctly-sized image

Since Deno edge functions don't have browser `canvas`, we'll use the **ImageScript** library (`https://deno.land/x/imagescript`) which supports pure-JS image manipulation.

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/_shared/imageResize.ts` | **New file** — shared utility: `cropToAspectRatio(imageBytes: Uint8Array, ratio: string): Promise<Uint8Array>` using ImageScript. Center-crops and resizes to target dimensions. |
| `supabase/functions/ai-agent/index.ts` | After image generation succeeds (after `extractImageFromAIResponse`), pass the decoded bytes through `cropToAspectRatio` before uploading to storage. |
| `supabase/functions/regenerate-post/index.ts` | Same change — apply `cropToAspectRatio` before upload. |
| `supabase/functions/_shared/agentToolExecutor.ts` | Same change — apply `cropToAspectRatio` before upload in the `generate_image` tool handler. |

### Target Dimensions Map

```text
"16:9"  → 1536×864  (landscape)
"9:16"  → 864×1536  (portrait)
"1:1"   → 1024×1024 (square)
```

### Crop Logic (center-crop)

```text
1. Decode image bytes → get width, height
2. Calculate target ratio (e.g. 16/9)
3. If image is too wide: crop sides equally
   If image is too tall: crop top/bottom equally
4. Resize to final target dimensions
5. Return PNG bytes
```

This guarantees the uploaded image always matches the user's selected ratio, regardless of what the AI model outputs.

