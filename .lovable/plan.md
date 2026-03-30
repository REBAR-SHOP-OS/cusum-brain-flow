

# Fix: Generate Button — Proper Audio Position & Text Sync

## Problem
1. All generated voiceover tracks get `globalStartTime: 0` — they should each start at their scene's cumulative position on the timeline
2. No `duration` is set on generated tracks — the position-aware playback effect can't determine when each track should play
3. The green bars all stack at position 0 instead of aligning with their respective scenes

## Fix (1 file)

### `src/components/ad-director/ProVideoEditor.tsx`

**In `generateAllVoiceovers` (~line 1273-1355):**

1. Compute cumulative scene start times at the beginning of the function (same logic as `cumulativeStarts` memo)
2. When pushing each new track, set:
   - `globalStartTime` = cumulative start of that scene
   - `duration` = measured `voDur` (or clip duration fallback)
3. Batch-update `voiceoverDurations` after the loop instead of inside it, to trigger the text overlay `useEffect` once with complete data

```typescript
// Before the for loop:
let cumStart = 0;
const sceneStarts: Record<string, number> = {};
for (const scene of storyboard) {
  sceneStarts[scene.id] = cumStart;
  const seg = segments.find(s => s.id === scene.segmentId);
  cumStart += seg ? seg.endTime - seg.startTime : 4;
}

// When pushing track:
newTracks.push({
  sceneId: scene.id,
  label: seg.label,
  audioUrl: url,
  kind: "voiceover",
  globalStartTime: sceneStarts[scene.id] ?? 0,
  duration: voDur ?? clipDur ?? (seg.endTime - seg.startTime),
});
```

This ensures each green bar appears at the correct timeline position matching its scene, and the position-aware playback logic can determine exactly when to play each voiceover.

## Result
- Generate button produces green bars aligned to their respective scenes
- Blue text overlays auto-sync via existing `useEffect` on `voiceoverDurations`
- Audio plays only when playhead reaches each bar's position

