

# Fix: Logo Button Activation & Square (1:1) Image Output

## Two Issues

### 1. Logo button behavior is inverted
Currently (line 138), the logo overlay is applied **whenever** `brandKit?.logo_url` exists, regardless of whether the user clicked the Logo chip. The Logo chip selection (`forceLogoOverlay`) is redundant.

**Fix**: Only apply logo overlay when the Logo chip is explicitly selected (`selectedThemes.has("logo")`). Remove the fallback that always applies it.

### 2. Images are not square (1:1) for Instagram
The generate-image edge function doesn't specify aspect ratio. The AI model produces whatever dimensions it wants.

**Fix**: 
- Add `"The image MUST be perfectly SQUARE (1:1 aspect ratio) — suitable for Instagram feed posts."` to the prompt in `buildAdPrompt` in the edge function.
- On the frontend, after generation, use Canvas to crop/resize to 1:1 if the AI doesn't comply perfectly.

## Changes

### `src/components/social/ImageGeneratorDialog.tsx`
**Line 136-145** — Change logo overlay logic:
```typescript
// Only apply logo when Logo theme is explicitly selected
if (selectedThemes.has("logo") && brandKit?.logo_url && finalImageUrl) {
```
Remove the `forceLogoOverlay` variable entirely.

**Line 116** — Only send logoUrl when Logo theme selected:
```typescript
logoUrl: selectedThemes.has("logo") ? (brandKit?.logo_url || undefined) : undefined,
```

### `supabase/functions/generate-image/index.ts`
**In `buildAdPrompt` function (line 86-89 area)** — Add square aspect ratio rule:
```
"- The image MUST be perfectly SQUARE (1:1 aspect ratio), suitable for Instagram feed posts."
```

### `src/lib/imageWatermark.ts`
Add an `ensureSquare` export that crops/pads to 1:1 using Canvas — called after generation as a safety net.

