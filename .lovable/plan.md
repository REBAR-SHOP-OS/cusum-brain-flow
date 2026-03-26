

# Snap Playhead to 1-Second Intervals + Live Video Sync

## Problem
When dragging the playhead on the timeline, it moves freely to any pixel position. The user wants it to snap to 1-second intervals, and the video preview should update in real-time as the playhead is dragged.

## Solution

### `src/components/ad-director/editor/TimelineBar.tsx`

**Snap to 1-second intervals during scrub:**
In the `onMove` handler (line 170-171), snap the calculated time to the nearest whole second:

```typescript
const rawTime = pct * totalDuration;
const snappedTime = Math.round(rawTime); // snap to nearest 1s
onSeek(Math.max(0, Math.min(totalDuration, snappedTime)));
```

Also apply the same snapping in `handleTrackClick` (line 296-298).

### `src/components/ad-director/ProVideoEditor.tsx`

**Remove the 100ms setTimeout delay in `handleGlobalSeek`** (line 928-932):
The delay prevents real-time video updates during scrubbing. Instead, seek the video immediately. If the scene hasn't changed, set `currentTime` directly without delay:

```typescript
const handleGlobalSeek = (globalTimeSec: number) => {
  let targetScene = 0;
  for (let i = 0; i < cumulativeStarts.length; i++) {
    if (globalTimeSec >= cumulativeStarts[i]) targetScene = i;
    else break;
  }
  const offset = globalTimeSec - cumulativeStarts[targetScene];
  
  if (targetScene !== selectedSceneIndex) {
    setSelectedSceneIndex(targetScene);
    // Defer only when switching scenes (video source changes)
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(offset, videoRef.current.duration || offset);
      }
    }, 100);
  } else {
    // Same scene — seek immediately for real-time scrubbing
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(offset, videoRef.current.duration || offset);
    }
  }
};
```

| File | Change |
|---|---|
| `TimelineBar.tsx` | Snap scrub + click positions to nearest 1-second |
| `ProVideoEditor.tsx` | Immediate video seek during same-scene scrubbing |

