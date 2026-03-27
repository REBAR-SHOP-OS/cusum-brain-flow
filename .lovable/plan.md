

# Smooth Playhead Movement (0.1s Granularity)

## Problem
The timeline playhead currently snaps to whole-second intervals during scrubbing and moves without animation during playback, resulting in jerky movement.

## Solution
Two changes in `src/components/ad-director/editor/TimelineBar.tsx`:

### 1. Smooth CSS transition on playhead
Add `transition: left 0.1s linear` to the playhead container so it glides smoothly between positions during playback. Disable the transition while scrubbing (dragging) to keep it responsive.

```tsx
// Line 525 — playhead style
style={{
  left: `${playheadPct}%`,
  width: '14px',
  transform: 'translateX(-6px)',
  transition: scrubbing ? 'none' : 'left 0.1s linear',
}}
```

### 2. 0.1s scrub granularity
Change `Math.round(...)` to round to 0.1s precision so the playhead can land between whole seconds during drag:

```tsx
// Line 184
const snappedTime = Math.round(pct * totalDuration * 10) / 10;
```

## Files changed
- `src/components/ad-director/editor/TimelineBar.tsx` — smooth transition + finer scrub granularity

