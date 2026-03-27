

# Fix Timeline: Real Drag Repositioning + Time Ruler

## Problem
1. Text and Audio bars snap to scene boundaries only — no free-positioning within or across scenes
2. No time ruler/markers on the video track

## Current State
- Drag logic exists but only moves items between scenes (`onMoveOverlay` changes `sceneId`)
- Bars always span the full width of their assigned scene — no `startTime`/`endTime` offsets
- `VideoOverlay` type already has `startTime` and `endTime` fields (optional)
- `AudioTrackItem` has no `startTime`/`endTime`

## Plan

### 1. Add time fields to AudioTrackItem
In `TimelineBar.tsx` interface, add optional `startTime` and `endTime` to `AudioTrackItem`. Also add callback `onRepositionAudioTrack` for fine-grained time updates.

### 2. Add time ruler above video track
Render a row of tick marks with second labels (0s, 2s, 4s...) above the video track. Ticks are positioned using `(sec / totalDuration) * 100%`. Major ticks every 2s, minor every 1s. Scales with `zoomLevel`.

### 3. Make bars freely draggable with pixel-accurate repositioning
Currently bars snap to scene boundaries. Change the drag-end handler to:
- Calculate the exact time position (in seconds) where the bar center lands
- Determine which scene that time falls into
- Calculate `startTime` relative to that scene's start
- Call `onMoveOverlay(id, newSceneId, startTimeSec)` or `onRepositionAudioTrack(index, newSceneId, startTimeSec)`

### 4. Position bars by absolute time, not scene boundaries
Change bar rendering from scene-based positioning to time-based:
- If overlay has `startTime`, position = `(cumulativeStarts[sceneIdx] + startTime) / totalDuration * 100%`
- Bar width = item duration (e.g. `endTime - startTime` or a default like 3s) rather than full scene width
- This allows bars to be narrower than scenes and positioned anywhere within them

### 5. Update ProVideoEditor handlers
- `handleMoveOverlay`: accept optional `startTime` parameter, update overlay's `startTime`
- Add `handleRepositionAudioTrack`: update audio track's `sceneId` and `startTime`

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — time ruler, free-position drag logic, time-based bar rendering
- `src/components/ad-director/ProVideoEditor.tsx` — update handlers to accept/store `startTime`

