

# Add Video Speed Control Icon to Toolbar

## What
Add a speed control icon (Gauge) to the timeline toolbar. Clicking it opens a popover with speed options (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x). The selected speed applies directly to the `<video>` element's `playbackRate`.

## Changes

### 1. `src/components/ad-director/ProVideoEditor.tsx`

- Add `Gauge` to lucide imports
- Add `videoSpeed` state (`useState(1)`)
- Add `"speed"` to `EditorTab` type
- Intercept `"speed"` tab click in `handleSetActiveTab` → open a speed popover dialog
- Apply `videoRef.current.playbackRate = videoSpeed` via a `useEffect` that watches `videoSpeed` and `selectedSceneIndex`
- Add a new sidebar tab entry: `{ id: "speed", label: "Speed", icon: <Gauge /> }`

### 2. Create `src/components/ad-director/editor/SpeedControlPopover.tsx`

A simple popover component:
- Shows current speed as badge on the Gauge icon
- Lists speed options: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×
- Highlights current selection
- Calls `onSpeedChange(value)` on click

### 3. Wire speed to video element

In `ProVideoEditor.tsx`, add useEffect:
```tsx
useEffect(() => {
  if (videoRef.current) {
    videoRef.current.playbackRate = videoSpeed;
  }
}, [videoSpeed, selectedSceneIndex, videoSrc]);
```

This ensures the playback rate is reapplied when switching scenes.

## Files changed
- `src/components/ad-director/editor/SpeedControlPopover.tsx` — new
- `src/components/ad-director/ProVideoEditor.tsx` — state, useEffect, toolbar icon, intercept handler

