

# Make Audio Tracks Selectable on Click

## Problem
Audio tracks on the timeline cannot be selected by clicking. Text overlays have `onClick` that opens an edit dialog, but audio bars have no click handler — only drag.

## Approach
Add a `selectedAudioTrackIndex` state inside `TimelineBar` and apply a visual selection ring when an audio bar is clicked. Clicking elsewhere (another track, empty area, or a scene) deselects.

## Changes

### File: `src/components/ad-director/editor/TimelineBar.tsx`

1. **Add local state** (after existing state declarations ~line 160):
   - `const [selectedAudioIdx, setSelectedAudioIdx] = useState<number | null>(null);`

2. **Add onClick to audio bar** (line 828, after `onMouseDown`):
   ```tsx
   onClick={(e) => { e.stopPropagation(); setSelectedAudioIdx(tIdx); }}
   ```

3. **Add visual selection style** (line 821 className):
   - When `selectedAudioIdx === tIdx`, add `ring-2 ring-white ring-offset-1 ring-offset-black/50` to highlight the selected bar

4. **Deselect on click outside** — add `onClick={() => setSelectedAudioIdx(null)}` on the audio track container div (line 797)

5. **Deselect when scene is clicked** — reset `selectedAudioIdx` to `null` when `selectedSceneIndex` changes (via `useEffect`)

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx`

