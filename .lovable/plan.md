

# Fix: Audio Track Z-Index & Position-Aware Playback

## Problems (from screenshot)
1. **Visual**: Green audio bar renders on top of the red playhead line — playhead should always be on top
2. **Functional**: Audio plays from the start of the scene regardless of where the green bar is positioned on the timeline. If user drags audio to start at 3s, audio should only be heard when playhead reaches 3s.

## Root Causes

### Z-Index
- Playhead is in the video track section with `z-20`
- Audio/text tracks are rendered in separate `div` sections *below* the video track in DOM order
- The playhead line doesn't extend into the audio/text track rows

### Audio Playback
- Current logic in `ProVideoEditor.tsx` (line ~690-780) finds voiceover by `sceneId` and plays it when the scene starts
- It completely ignores `globalStartTime` — the track always plays from `currentTime: 0` synced to video start
- No mechanism checks "is the playhead currently within this audio track's time range?"

## Solution

### File 1: `src/components/ad-director/editor/TimelineBar.tsx`

**Extend playhead across all track rows**: Move the playhead rendering to a wrapper that spans video + text + audio rows, or add a secondary playhead line in the text and audio rows. The cleanest approach: wrap all track rows (video, text, audio) in a single `relative` container and render the playhead once across all of them with a higher z-index (`z-40`).

### File 2: `src/components/ad-director/ProVideoEditor.tsx`

**Position-aware voiceover playback**: Modify the voiceover playback effect to:
1. Calculate the global time of the current playback position
2. For each voiceover track, check if `globalTime` falls within `[globalStartTime, globalStartTime + duration]`
3. If yes, calculate the offset into the audio: `audioOffset = globalTime - globalStartTime`
4. Set `audio.currentTime = audioOffset` and play
5. If playhead is outside the track's range, pause/don't play the audio

Key change in the playback effect (~line 697):
```typescript
// Instead of finding VO by sceneId:
const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);

// Find VO by global time position:
const activeVo = audioTracks.find(a => {
  if (a.kind !== "voiceover") return false;
  const start = a.globalStartTime ?? 0;
  const dur = a.duration ?? totalDuration;
  return globalTime >= start && globalTime < start + dur;
});
```

Then set `audio.currentTime = globalTime - (activeVo.globalStartTime ?? 0)` instead of syncing to video currentTime.

Also update the `timeupdate` sync handler to pause audio when playhead moves outside the track's range.

## Files Changed
1. `src/components/ad-director/editor/TimelineBar.tsx` — playhead spans all rows
2. `src/components/ad-director/ProVideoEditor.tsx` — position-aware audio playback

## Result
- Red playhead line is always visible on top of all track bars
- Audio only plays when playhead is within the audio track's time range
- Dragging the audio bar to a different position changes when the audio is heard

