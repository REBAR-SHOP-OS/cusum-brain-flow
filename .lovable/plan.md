

# Always Include Logo & Ad Text in Generated Images

## Problem
1. `VideoStudioContent` calls `generate-image` without `brandContext` or `logoUrl` — so images from that path have no branding at all
2. The prompt in `buildAdPrompt` says "The company logo will be added as a separate overlay" — this tells the AI model NOT to render the logo, contradicting the user's requirement
3. The logo instruction (line 183) says "watermark in the corner" — too subtle; user wants prominent branding

## Changes

### 1. `supabase/functions/generate-image/index.ts` — Strengthen prompt
- **Line 127**: Remove "The company logo will be added as a separate overlay" — replace with instruction to render the logo prominently inside the image
- **Line 183**: Change "branded watermark in the corner" to "Render this logo prominently and clearly in the image — make it a visible, professional part of the design, not just a small watermark"
- Add a hard rule: "The final image MUST contain: 1) The company logo rendered clearly and prominently, 2) At least one line of advertising text (brand name, tagline, or CTA)"

### 2. `src/components/social/VideoStudioContent.tsx` — Pass brand context
- **Line 306**: Add `brandContext` and `logoUrl` from `brandKit` to the `generate-image` call, matching the pattern already used in `ImageGeneratorDialog.tsx`

## Files Changed
- `supabase/functions/generate-image/index.ts`
- `src/components/social/VideoStudioContent.tsx`

