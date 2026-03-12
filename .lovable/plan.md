

# Add "Logo" Visual Theme Chip to Image Generator

## What
Add a "Logo" chip to the Visual Themes row that displays the brand logo. When selected, the logo overlay is **mandatory** on the generated image — matching the Pixel Agent's branding behavior.

## Changes — `src/components/social/ImageGeneratorDialog.tsx`

### 1. Add LOGO entry to `VISUAL_THEMES`
Add a new theme `{ id: "logo", label: "Logo", icon: Stamp, promptTag: "with company branding" }` at the end of the array.

### 2. Show brand logo preview inside the chip
When `id === "logo"` and `brandKit?.logo_url` exists, render a tiny `<img>` of the logo instead of the generic icon.

### 3. Force logo overlay when "logo" theme is selected
In `handleGenerate`, after image generation:
- If `selectedThemes.has("logo")` → always apply `applyLogoToImage()` regardless of whether brandKit logo auto-applies
- The existing logic already applies the logo when `brandKit?.logo_url` exists, so we just need to ensure it's not skipped when the logo theme is active
- Also pass `logoUrl` to the edge function prompt so the AI model is instructed to consider branding in the composition

### 4. Disable the Logo chip if no logo is uploaded
If `!brandKit?.logo_url`, show the chip in a disabled/greyed state with a tooltip "Upload a logo in Brand Kit first".

Two small edits in one file. No backend changes.

