

## Use Pixel Agent's Image Generation Brain in Auto-Generate

### Problem
The "Auto-generate today" button uses a simple single-shot image generation (one `fetch` call, no logo, no retry, no dedup), producing lower-quality images compared to the Pixel agent which uses `generatePixelImage()` with logo overlay, multi-model retry, and dedup logic.

### Solution
Replace the inline image generation code in `auto-generate-post/index.ts` with the same `generatePixelImage` function used by the Pixel agent. This requires:

1. Extracting `generatePixelImage`, `extractImageFromAIResponse`, and `resolveLogoUrl` into a shared module
2. Updating auto-generate to use these shared functions
3. Enhancing the image prompt in auto-generate to match Pixel's detailed prompt structure (visual styles, dedup, mandatory text overlay)

### Changes

#### 1. New shared file: `supabase/functions/_shared/pixelImageGenerator.ts`
Extract from `ai-agent/index.ts`:
- `resolveLogoUrl()` 
- `extractImageFromAIResponse()` (need to check its location)
- `generatePixelImage()` 

These become importable shared utilities.

#### 2. Update `supabase/functions/auto-generate-post/index.ts`
- Import `generatePixelImage` and `resolveLogoUrl` from shared module
- Replace the inline image generation block (lines 299-356) with a call to `generatePixelImage(imagePrompt, supabaseAdmin, logoUrl, { styleIndex })`
- Enhance the `image_prompt` construction to match Pixel's format: include visual style selection from the same style pool, mandatory photorealism rules, text overlay instructions, and dedup hints from recent images
- Fetch recent image names from `social-images/pixel` for dedup (same as Pixel agent)
- Use the returned public URL from `social-images` bucket (same as Pixel)

#### 3. Update `supabase/functions/ai-agent/index.ts`
- Import `generatePixelImage`, `resolveLogoUrl`, `extractImageFromAIResponse` from the shared module instead of defining them inline

### Key Details

**Image prompt structure** (matching Pixel agent):
```
MANDATORY REALISM RULE + VISUAL STYLE: [random from 12 styles] + PRODUCT FOCUS + THEME + 
MANDATORY text overlay + dedup hints + forbidden styles + session seed + diversity rules
```

**Retry pipeline** (from `generatePixelImage`):
1. `gemini-2.5-flash-image` with logo
2. `gemini-2.5-flash-image` with logo (retry)  
3. `gemini-3-pro-image-preview` with logo (fallback)

**Storage**: Images stored in `social-images/pixel/` bucket (same as Pixel agent) instead of `social-media-assets/images/`

### Files to Change
1. `supabase/functions/_shared/pixelImageGenerator.ts` — New shared module
2. `supabase/functions/auto-generate-post/index.ts` — Use shared image generator
3. `supabase/functions/ai-agent/index.ts` — Import from shared module

