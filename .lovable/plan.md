

# Fix: Video, Script & Voiceover Timing Imbalance

## Problem

Three independent durations are never synchronized:
1. **Script segment timing** (e.g., `startTime: 0, endTime: 2`) — set by AI during script generation, static
2. **Actual video clip duration** — determined by the generation model (often 5s, 10s, or 15s)
3. **Voiceover TTS audio duration** — determined by text length and ElevenLabs speech rate

The timeline uses segment timing for `sceneDurations` (line 120-125), but the video plays its natural duration and the voiceover plays at its own pace. This causes:
- Voiceover finishing before/after the video ends
- Timeline progress bar not matching actual playback
- Auto-advance triggering based on video end, not accounting for voiceover still playing
- Scene transitions cutting off voiceover mid-sentence

## Solution: Use actual media durations as the source of truth

### 1. Update `sceneDurations` to use real video duration (lines 120-125)
Instead of `seg.endTime - seg.startTime`, use the **actual video clip duration** from the `<video>` metadata. Store each clip's real duration in state as clips load. Fall back to segment timing only if clip duration is unknown.

### 2. Track voiceover durations and sync auto-advance (lines 531-550)
On `handleVideoEnded`, check if the voiceover for the current scene is still playing. If so, **wait for voiceover to finish** before advancing to the next scene. This prevents mid-sentence cuts.

### 3. Update segment timings to reflect reality
After voiceovers are generated, measure each voiceover blob's duration using `Audio.duration` and update segment `startTime`/`endTime` to match. This keeps the timeline accurate.

### 4. Voiceover playback rate adjustment
When a voiceover is longer than the video clip, set `audioRef.current.playbackRate` to compress it slightly (max 1.3x) to fit. When shorter, let it finish naturally and hold the scene.

## File Changes

### `src/components/ad-director/ProVideoEditor.tsx`

**A. Add clip duration tracking state:**
```typescript
const [clipDurations, setClipDurations] = useState<Record<string, number>>({});
```
On `handleLoaded`, store `videoRef.current.duration` keyed by current scene ID.

**B. Fix `sceneDurations` (line 120-125):**
```typescript
const sceneDurations = useMemo(() => {
  return storyboard.map((scene) => {
    // Priority: actual clip duration > voiceover duration > segment timing
    const clipDur = clipDurations[scene.id];
    const voTrack = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === scene.id);
    const seg = segments.find(s => s.id === scene.segmentId);
    const segDur = seg ? seg.endTime - seg.startTime : 4;
    return clipDur || segDur;
  });
}, [storyboard, segments, clipDurations, audioTracks]);
```

**C. Fix `handleVideoEnded` (line 531-550):**
Wait for voiceover to end before advancing:
```typescript
const handleVideoEnded = () => {
  const voStillPlaying = audioRef.current && !audioRef.current.paused && !audioRef.current.ended;
  if (voStillPlaying) {
    // Wait for voiceover to finish, then advance
    audioRef.current!.onended = () => advanceToNextScene();
    return;
  }
  advanceToNextScene();
};
```

**D. After voiceover generation (line 582-616):**
Measure each generated voiceover blob's duration via `new Audio(url)` + `loadedmetadata` event and update segment timing accordingly, so the timeline reflects real voiceover length.

**E. Voiceover sync (lines 219-266):**
When starting voiceover playback, compare voiceover duration to video duration. If voiceover is significantly longer, apply a slight speedup (max 1.3x). If shorter, play at 1x and let the remaining video time run silently.

### Summary
- Single file change: `ProVideoEditor.tsx`
- No backend changes
- Timeline becomes accurate by using measured durations
- Auto-advance waits for voiceover completion
- Voiceover playback rate adjusts to fit video length

