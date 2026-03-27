

# Add Aspect Ratio Selector to Video Editor

## Summary
Add an aspect ratio icon/button in the editor's playback controls bar. When the user selects a ratio, the video preview container resizes accordingly (e.g., 16:9 → widescreen, 9:16 → portrait, 1:1 → square). The CSS `aspect-ratio` and container constraints update in real-time.

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`

1. **Add state**: `aspectRatio` with default `"16:9"` and a popover toggle
2. **Add Aspect Ratio Popover** in the playback controls bar (line ~1584), next to fullscreen button:
   - Icon: `RectangleHorizontal` or `Ratio` from lucide-react
   - Popover with ratio buttons: `16:9`, `9:16`, `1:1`, `4:3`, `4:5`, `21:9`
3. **Apply ratio to video container** (line ~1497): Replace `aspect-square` with dynamic `style={{ aspectRatio }}` based on selected ratio
4. **Apply to canvas** for static cards: Update `canvas.width` / `canvas.height` based on ratio
5. **Pass ratio to video element**: The `object-contain` class already handles fitting — just the container shape changes

### Ratio → CSS mapping
```typescript
const ASPECT_RATIOS = {
  "16:9": "16/9",
  "9:16": "9/16", 
  "1:1": "1/1",
  "4:3": "4/3",
  "4:5": "4/5",
  "21:9": "21/9",
};
```

### Video container change (line 1497)
```tsx
// Before:
<div className="... aspect-square max-h-[60vh]">

// After: 
<div className="... max-h-[60vh]" style={{ aspectRatio: ASPECT_RATIOS[aspectRatio] }}>
```

### Canvas dimensions for static cards
```typescript
const ratioDims: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1": [1080, 1080],
  "4:3": [1080, 810],
  "4:5": [1080, 1350],
  "21:9": [1260, 540],
};
```

## File Changed
- `src/components/ad-director/ProVideoEditor.tsx`

