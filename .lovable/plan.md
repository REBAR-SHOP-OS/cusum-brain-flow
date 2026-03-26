

# Make Timeline Playhead Draggable

## Problem
The playhead (white vertical line with circle on timeline) is currently `pointer-events-none` — it only moves based on playback time. The user wants to drag it left/right to scrub through the video.

## Changes

### `src/components/ad-director/editor/TimelineBar.tsx`

1. **Remove `pointer-events-none`** from the playhead div (line 479)
2. **Add `cursor-grab` / `cursor-grabbing`** styling and a wider hit area for easier grabbing
3. **Add `onMouseDown` handler** on the playhead that starts a scrub drag:
   - Track `scrubbing` state via a ref
   - On `mousemove`: calculate percentage from mouse X relative to `trackRef`, call `onSeek(pct * totalDuration)`
   - On `mouseup`: stop scrubbing
4. **Widen the playhead hit target** — add a transparent 12px-wide div around the 2px line so it's easy to grab
5. **Visual feedback** — slightly enlarge the playhead circle while dragging

The existing `handleTrackClick` already supports clicking anywhere on the track to seek. This adds continuous drag-to-scrub on the playhead itself.

| File | Change |
|---|---|
| `TimelineBar.tsx` | Make playhead draggable with mousedown/mousemove/mouseup scrub logic |

