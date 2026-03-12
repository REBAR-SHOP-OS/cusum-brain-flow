

# Add Company Logo to AI-Generated Ad Images

## Problem
Generated advertising images don't include the company logo. The user wants the logo from the brand kit to always appear on generated images.

## Approach
After the AI generates the image (base64), composite the brand logo on top using a second Gemini call or — more reliably — do it client-side with Canvas (same pattern already used for video watermarking via `applyLogoWatermark`). The Canvas approach is deterministic and guarantees correct logo placement, unlike asking the AI model to embed a logo (which produces garbled text/logos).

## Changes

### 1. `src/components/social/ImageGeneratorDialog.tsx`
- Import `useBrandKit` (already imported) and read `brandKit.logo_url`
- Pass `logo_url` in the request body to the edge function
- After receiving the generated image, apply the logo as a watermark client-side using Canvas (bottom-right corner, semi-transparent)
- Add a new status step: "Applying brand logo..." between generation and completion
- Show a "Branded" badge on the completed image

### 2. Create utility: `src/lib/imageWatermark.ts`
- `applyLogoToImage(imageUrl: string, logoUrl: string, opacity?: number): Promise<string>`
- Loads both images onto a Canvas, draws the logo at bottom-right (10% padding, ~15% of image width)
- Returns a data URL of the composited image
- This mirrors the existing `applyLogoWatermark` pattern used for videos

### 3. `supabase/functions/generate-image/index.ts`
- Update `buildAdPrompt` to explicitly instruct: "Do NOT attempt to render any logo or brand text in the image — the logo will be added separately as an overlay"
- This prevents the AI from trying to render garbled logo text

## Flow
```text
User prompt → Pexels reference → Gemini generates image
    → Client receives base64 image
    → Canvas composites brand logo on top
    → Final branded image displayed
```

No changes to the edge function's core logic — the logo overlay is purely client-side for pixel-perfect results.

