

# Make Audio Track Freely Draggable Across Timeline

## Problem
The audio track in the Ad Director timeline is currently anchored to a single scene (`sceneId`). When music or voiceover is generated, it's tied to one scene and its position is relative to that scene. The user wants to freely drag the audio bar to any position across the entire video timeline.

## Current State
- Audio tracks have `sceneId`, `startTime`, `endTime` (relative to scene)
- Drag code exists but repositions by changing `sceneId` + recalculating local time
- Music tracks created with `startTime: 0`, no `endTime` → span one scene's duration
- Moving across scenes recalculates duration per-scene, causing the bar to shrink/expand

## Proposed Fix

### 1. Add global positioning to AudioTrackItem
**File**: `src/components/ad-director/editor/TimelineBar.tsx`
- Add optional `globalStartTime` field to `AudioTrackItem` interface
- When `globalStartTime` is set, render the audio bar at that absolute position instead of scene-relative
- Calculate `leftPct` and `widthPct` from `globalStartTime` and track duration directly

### 2. Update drag-drop handler to use global time
**File**: `src/components/ad-director/ProVideoEditor.tsx`
- Update `handleMoveAudioTrack` to set `globalStartTime` (absolute seconds in timeline) instead of recalculating scene-relative positions
- Preserve the track's original duration when moving
- Clamp to `[0, totalDuration - trackDuration]`

### 3. Update audio track creation to set proper duration
**File**: `src/components/ad-director/ProVideoEditor.tsx`
- When generating music, set `globalStartTime: 0` and `endTime` based on actual audio duration or total video duration
- When generating voiceover, set `globalStartTime` to the cumulative start of the target scene

### 4. Update rendering logic
**File**: `src/components/ad-director/editor/TimelineBar.tsx`
- In the audio track rendering section (line 802-848), check for `globalStartTime` first
- If present, compute position directly: `leftPct = (globalStartTime / totalDuration) * 100`
- Track duration = `endTime - startTime` or fallback to scene duration

## Files to Change
1. `src/components/ad-director/editor/TimelineBar.tsx` — AudioTrackItem type + rendering + drag
2. `src/components/ad-director/ProVideoEditor.tsx` — handleMoveAudioTrack + track creation

## Result
Audio bars can be freely dragged to any position on the timeline, maintaining their duration. The position is stored as absolute time, not scene-relative.

