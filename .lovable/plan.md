

# Fix: All Track Bars Start from Zero Point

## Problem
Text overlay bars and audio bars are positioned starting from their associated scene's start time. The user wants all bars to start exactly from position 0 on the timeline.

## Changes — `src/components/ad-director/editor/TimelineBar.tsx`

### 1. Text overlay bars (lines 875-882)
Change the positioning calculation so the bar starts at 0 and extends to its current end:
```tsx
// Before:
const absStart = sceneStart + itemStart;
const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
const leftPct = (absStart / totalDuration) * 100;
const widthPct = ((absEnd - absStart) / totalDuration) * 100;

// After:
const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
const leftPct = 0;
const widthPct = (absEnd / totalDuration) * 100;
```

### 2. Audio track bars (lines 926-945)
Same change — force `leftPct = 0` and extend width from 0 to the bar's original end position:
- For `globalStartTime`-based tracks: `leftPct = 0`, `widthPct = ((globalStartTime + trackDur) / totalDuration) * 100`
- For scene-based tracks: `leftPct = 0`, `widthPct = (absEnd / totalDuration) * 100`

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx`

## Result
All text and audio bars will start from the leftmost edge (0s) of the timeline, aligned with the video track's starting point.

