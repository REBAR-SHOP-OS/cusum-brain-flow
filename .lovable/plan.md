

# Fix Mute & Replace Fixed Stretch with Drag-to-Resize

## Issues Found

1. **Mute not working**: `handleMuteScene` correctly tracks `mutedScenes` state (Set of scene IDs), but the voiceover playback effect (line 185-220) never checks `mutedScenes` — it always plays audio for the active scene. The video element volume is also unaffected.

2. **Trim not working either**: `handleTrimScene` calls `onUpdateSegment(seg.id, seg.text)` which only updates the text, never changes the timing. The segment `endTime` is never modified.

3. **Stretch is just a toast**: `handleStretchScene` shows a toast message but performs zero logic — no timing change at all.

4. **User wants mouse-based stretch**: Instead of fixed +1s buttons, clips should be draggable from their edges on the timeline to resize.

## Plan

### 1. Add `onUpdateSegmentTiming` callback
- In `AdDirectorContent.tsx`: add a new prop handler that updates a segment's `startTime`/`endTime`
- Pass it to `ProVideoEditor` as a new prop

### 2. Fix `handleTrimScene` and `handleStretchScene` in `ProVideoEditor.tsx`
- Both should call the new timing update callback to actually change `seg.endTime`
- Trim: `endTime -= 1` (min 1s duration)
- Stretch: `endTime += 1`

### 3. Fix Mute in voiceover playback effect
- In the `useEffect` at line 185: add `mutedScenes` to the check — if `mutedScenes.has(sceneId)`, skip voiceover playback
- Also mute the `<video>` element volume when the current scene is muted

### 4. Add drag-to-resize on timeline clip edges
- In `TimelineBar.tsx`: add invisible drag handles (4px wide) on the left and right edges of each video scene block
- On `mousedown` on a handle, track `mousemove` to compute new duration based on pixel delta relative to total timeline width
- On `mouseup`, call a new `onResizeScene(index, newDuration)` callback
- Keep "Trim (−1s)" and "Stretch (+1s)" in the popover as quick shortcuts, but the primary interaction is drag

### Files
- **Edit**: `src/components/ad-director/AdDirectorContent.tsx` — add `onUpdateSegmentTiming` handler
- **Edit**: `src/components/ad-director/ProVideoEditor.tsx` — fix mute effect, fix trim/stretch handlers, add resize handler, wire new prop
- **Edit**: `src/components/ad-director/editor/TimelineBar.tsx` — add drag handles on clip edges, add `onResizeScene` prop

