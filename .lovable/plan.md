

# Auto-Brand All Generated Images (Logo + Ad Text)

## Problem
1. Logo overlay is only applied when user manually clicks the "Logo" theme chip — it should be automatic whenever a brand logo exists
2. The AI prompt explicitly says "Do NOT include any text" — but images should contain advertising slogans/text
3. Logo chip appears disabled (greyed out) when no logo is uploaded, but should auto-enable when logo exists

## Changes

### 1. `src/components/social/ImageGeneratorDialog.tsx`
- **Auto-select Logo theme**: When the dialog opens and `brandKit?.logo_url` exists, automatically add `"logo"` to `selectedThemes`
- **Always apply logo overlay**: After image generation, always apply `applyLogoToImage` when `brandKit?.logo_url` exists (remove the `selectedThemes.has("logo")` condition)
- **Pass brand text info**: Send `tagline`, `value_prop`, `business_name` to edge function for text overlay in the prompt

### 2. `supabase/functions/generate-image/index.ts`
- **Update `buildAdPrompt`**: Remove the rule "Do NOT include any text, watermarks, or logos" and replace with instructions to include:
  - Company name/brand text as a subtle overlay
  - A short advertising slogan or tagline from brand context
  - Professional typography placement (bottom or corner)
- **Always pass logoUrl**: Send brand logo to the AI model for natural integration into the image

### 3. Flow After Changes
```text
User clicks Generate
  → Edge function builds prompt WITH ad text instructions
  → AI generates image with embedded advertising text
  → Client applies logo watermark overlay (always, if logo exists)
  → Final image = photorealistic + ad slogans + brand logo
```

## Files Changed
- `src/components/social/ImageGeneratorDialog.tsx` — auto-enable logo, always overlay
- `supabase/functions/generate-image/index.ts` — prompt includes ad text instructions

