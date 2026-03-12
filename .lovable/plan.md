

# Fix: Music Track Playback Not Working

## Problem
The play button on generated music tracks doesn't produce audio. The UI toggles to the pause icon (state updates) but no sound plays. The `audio.play()` call fails silently.

## Root Causes

1. **Nested `<button>` elements** — The play button is a `<button>` inside another `<button>`. This is invalid HTML and causes unpredictable click event behavior across browsers. The outer button's `onClick` may swallow the event despite `stopPropagation`.

2. **Silent play() failure** — `audio.play()` returns a Promise but it's not awaited or caught, so errors are swallowed. Browser autoplay policies or invalid audio data cause silent failures.

3. **No error handling on Audio element** — No `onerror` or `canplaythrough` listeners, so if the blob URL is invalid or the content-type is wrong (e.g., JSON error response treated as audio), it silently does nothing.

## Fix — `src/components/ad-director/editor/MusicTab.tsx`

**Change 1**: Replace nested `<button>` with a `<div>` for the outer container to fix the invalid HTML nesting.

**Change 2**: Make `playTrack` async with proper error handling:
```typescript
const playTrack = async (track: MusicTrack) => {
  if (!track.url) return;
  if (playing === track.id) {
    audioRef.current?.pause();
    setPlaying(null);
    return;
  }
  if (audioRef.current) {
    audioRef.current.pause();
  }
  const audio = new Audio(track.url);
  audioRef.current = audio;
  audio.onended = () => setPlaying(null);
  audio.onerror = () => {
    setPlaying(null);
    toast({ title: "Playback failed", variant: "destructive" });
  };
  try {
    await audio.play();
    setPlaying(track.id);
  } catch {
    setPlaying(null);
    toast({ title: "Playback failed", variant: "destructive" });
  }
};
```

**Change 3**: Move `setPlaying(track.id)` to after successful `await audio.play()` so the UI only shows pause icon when audio is actually playing.

**Change 4**: Add a persistent `<audio>` element in the DOM as a fallback for browsers that block programmatic Audio construction, and add `preload="auto"` for better compatibility.

## File Modified
- `src/components/ad-director/editor/MusicTab.tsx`

