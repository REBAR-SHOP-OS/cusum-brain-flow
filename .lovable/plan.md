

# Visual Editor for Intro & Outro Cards

## Current State
Intro and outro scenes are generated as static canvas images (`generateEndCardPreview` in `AdDirectorContent.tsx`) with hardcoded layout: gradient background, brand name, tagline, CTA, and website — all fixed positions, sizes, and fonts. There's no way to customize them after generation.

## Plan

### 1. Create `IntroOutroEditor` component
New file: `src/components/ad-director/editor/IntroOutroEditor.tsx`

A visual editing panel that appears in the right sidebar (or replaces the center canvas area) when an intro/outro static-card scene is selected. It provides:

- **Text fields**: Editable inputs for Headline, Subheadline, CTA text, Website URL — pre-populated from `brand` profile
- **Font controls**: Size slider (24–96px), font family dropdown (Space Grotesk, Inter, serif options), bold/italic toggles
- **Color controls**: Background gradient start/end color pickers (pre-filled from brand primary/secondary), text color picker
- **Logo controls**: Position (top/center/bottom), size slider, toggle show/hide
- **Layout presets**: Quick-select layouts — "Centered Stack", "Left-aligned", "Logo Top + Text Bottom", "Minimal"
- **Live preview**: The center canvas renders the card in real-time as the user edits (using a `<canvas>` element that redraws on every change)
- **Apply button**: Re-generates the static card data URL with the customized settings and updates the clip

### 2. Define `IntroOutroCardSettings` type
New file or extend `src/types/adDirector.ts`:

```typescript
interface IntroOutroCardSettings {
  headline: string;
  subheadline: string;
  cta: string;
  website: string;
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
  fontFamily: string;
  headlineFontSize: number;
  subFontSize: number;
  logoPosition: "top" | "center" | "bottom";
  logoScale: number;
  showLogo: boolean;
  layout: "centered" | "left" | "logo-top" | "minimal";
}
```

### 3. Integrate into `ProVideoEditor.tsx`
- Detect when the selected scene is a static card (intro/outro) — already have `isStaticCard`
- When `isStaticCard` is true, show a floating "Edit Card" button on the center canvas
- Clicking it opens the `IntroOutroEditor` in the left sidebar panel (new tab or overlay)
- Store card settings per scene in state: `Map<sceneId, IntroOutroCardSettings>`

### 4. Update `generateEndCardPreview` in `AdDirectorContent.tsx`
- Accept optional `IntroOutroCardSettings` parameter
- Use settings for fonts, colors, layout, logo placement instead of hardcoded values
- Pass `onRegenerateEndCard` callback down to ProVideoEditor so edits can trigger re-render

### 5. Live canvas preview in center area
- When editing a static card, replace the `<img>` tag with a `<canvas>` element
- A `useEffect` redraws the canvas whenever card settings change, giving instant visual feedback
- Logo is drawn on the canvas using `drawImage` with position/scale from settings

## Files Changed
- `src/types/adDirector.ts` — add `IntroOutroCardSettings` interface
- `src/components/ad-director/editor/IntroOutroEditor.tsx` — new component
- `src/components/ad-director/ProVideoEditor.tsx` — integrate editor, live canvas preview
- `src/components/ad-director/AdDirectorContent.tsx` — parameterize `generateEndCardPreview`

