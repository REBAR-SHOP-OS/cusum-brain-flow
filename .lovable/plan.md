

# Fix: Click on Video Track Moves Playhead to Click Position

## Problem
Clicking on the video track scenes calls `onSelectScene(i)` with `e.stopPropagation()`, which prevents the parent `handleTrackClick` from firing. The playhead never moves to where the user clicks. Text and Audio track rows also lack click-to-seek behavior.

## Solution (1 file)

### `src/components/ad-director/editor/TimelineBar.tsx`

**1. Scene click — also seek playhead (line 713)**
Change the scene `onClick` to both select the scene AND seek the playhead to the click position:
```typescript
onClick={(e) => {
  e.stopPropagation();
  onSelectScene(i);
  // Also move playhead to click position
  if (trackRef.current) {
    const rect = trackRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const timeSec = pct * totalDuration;
    onSeek(Math.max(0, Math.min(totalDuration, timeSec)));
  }
}}
```

**2. Text overlay track — add click-to-seek (line 863)**
Add `onClick={handleTrackClick}` to the text track container `div`. Update existing text bar click to also seek.

**3. Audio track — add click-to-seek (line 912)**
The audio container already has `onClick={() => setSelectedAudioIdx(null)}`. Change it to also seek:
```typescript
onClick={(e) => {
  setSelectedAudioIdx(null);
  handleTrackClick(e);
}}
```

**4. Update `handleTrackClick` to work with any track row (line 384)**
Currently it uses `trackRef.current` (video track). Change it to use the event target's parent container or accept the element from `e.currentTarget`:
```typescript
const handleTrackClick = (e: React.MouseEvent) => {
  const rect = (trackRef.current ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
  // account for the 14-unit label offset
  const pct = (e.clientX - rect.left) / rect.width;
  const timeSec = pct * totalDuration;
  onSeek(Math.max(0, Math.min(totalDuration, timeSec)));
};
```
Remove the `snapToSceneBoundary` call from `handleTrackClick` so the playhead goes exactly where clicked (snap is still used during scrubbing).

## Result
- Click anywhere on video, text, or audio track → playhead jumps to that exact position
- Scene selection still works alongside playhead movement
- No snapping on click — precise positioning

