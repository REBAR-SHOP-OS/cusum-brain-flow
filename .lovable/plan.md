

# Fix: Audio Track Drag-and-Drop Stays Where Released

## Problem
When dragging the green audio bar and releasing it at a new position, it snaps back or doesn't land where expected. Root cause: audio tracks are created without `globalStartTime` or `duration`, so:
1. First drag: `duration` falls back to `totalDur` (full video length), making `clampedStart = max(0, min(x, 0)) = 0` — always snaps to start
2. The track width spans the entire timeline, so visually it looks like it didn't move

## Fix (2 files)

### File 1: `src/components/ad-director/ProVideoEditor.tsx`

**handleMoveAudioTrack** (line 1431-1442): Fix the duration fallback. Instead of falling back to `totalDur` (which makes clamping useless), calculate actual duration from audio element or use a reasonable default (e.g., the track's current visual span). Remove the aggressive clamping that forces `clampedStart` to 0 when `dur === totalDur`.

```typescript
const handleMoveAudioTrack = useCallback((index: number, _newSceneId: string, absoluteTime?: number) => {
  setAudioTracks(prev => prev.map((at, i) => {
    if (i !== index || absoluteTime == null) return at;
    const totalDur = segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0) || 30;
    // Use existing duration, or compute from start/end, or default to scene duration
    const trackDur = at.duration 
      ?? (at.endTime != null && at.startTime != null ? at.endTime - at.startTime : null)
      ?? totalDur; // full-span tracks stay full-span
    const clampedStart = Math.max(0, Math.min(absoluteTime, totalDur));
    return { ...at, globalStartTime: clampedStart, duration: trackDur };
  }));
}, [segments]);
```

Key change: Clamp to `totalDur` (not `totalDur - dur`), so full-span audio can still be repositioned.

**Audio track creation** (lines ~303, ~323, ~487, ~1406): Add `globalStartTime: 0` and compute actual `duration` when creating tracks, so they have explicit values from the start.

### File 2: `src/components/ad-director/editor/TimelineBar.tsx`

No changes needed — the rendering and drag calculation logic is correct. The issue is entirely in how `handleMoveAudioTrack` clamps the position.

## Result
- Dragging the audio bar and releasing it places it exactly at the drop position
- Full-span music tracks can be repositioned to start at any point
- Voiceover clips maintain their duration when moved

