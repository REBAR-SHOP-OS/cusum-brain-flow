

# Fix: Voiceover Glitching and Repeating

## Root Causes

1. **Dead code after return** (line 290): `currentVoUrlRef.current = null` sits after `return cleanup` — unreachable but harmless. The real issue is elsewhere.

2. **Effect re-triggers too aggressively**: The voiceover effect (line 230) depends on `[audioTracks, storyboard]` — both are arrays that get new references on state updates (e.g. volume changes, track additions). Each new reference triggers cleanup → 150ms debounce → new Audio instance. During the 150ms gap, another trigger can fire, creating overlapping instances.

3. **Cleanup race with debounce**: When cleanup runs, it clears `audioRef.current` (line 238). But the debounced `setTimeout` (line 259) still fires 150ms later and creates a *new* Audio — now there are two playing. The debounce timeout is cleared in cleanup, but only if cleanup runs *before* the timeout fires. If cleanup and timeout fire in the same tick order, duplication occurs.

4. **No guard inside debounce callback**: The callback at line 259 doesn't check if the effect has been superseded. It blindly creates and plays a new Audio.

## Fixes — `src/components/ad-director/ProVideoEditor.tsx`

### A. Add cancelled flag to prevent stale debounce callbacks
Add a `let cancelled = false` flag at the top of the effect. Set it in cleanup. Check it inside the debounce callback before creating Audio.

### B. Stabilize voiceover URL lookup with useRef
Instead of depending on `audioTracks` array directly, store the current scene's voiceover URL in a ref that updates via a separate, non-destructive effect. The main playback effect only depends on `selectedSceneIndex, isPlaying, isMuted`.

### C. Remove dead code at line 290

### D. Concrete implementation

```typescript
// New ref to track current VO URL without re-triggering playback effect
const currentSceneVoRef = useRef<{ url: string; volume: number } | null>(null);

// Lightweight effect — updates ref, no Audio teardown
useEffect(() => {
  const sceneId = storyboard[selectedSceneIndex]?.id;
  const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
  currentSceneVoRef.current = vo ? { url: vo.audioUrl, volume: vo.volume ?? 1 } : null;
}, [audioTracks, storyboard, selectedSceneIndex]);

// Main playback effect — only re-runs on play state or scene change
useEffect(() => {
  let cancelled = false;
  // ... cleanup, sceneTransitioning check, mute check same as before ...
  
  const vo = currentSceneVoRef.current;
  if (vo && isPlaying && !isMuted) {
    if (audioRef.current && currentVoUrlRef.current === vo.url && !audioRef.current.paused) {
      return cleanup;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    
    voDebounceRef.current = setTimeout(() => {
      if (cancelled) return; // Guard against stale callback
      const a = new Audio(vo.url);
      // ... rest of setup ...
      audioRef.current = a;
      currentVoUrlRef.current = vo.url;
    }, 150);
    return cleanup;
  }
  cleanup();
  return cleanup;
}, [selectedSceneIndex, isPlaying, isMuted, mutedScenes]);
// Removed audioTracks and storyboard from deps
```

This eliminates the root cause: `audioTracks`/`storyboard` reference changes no longer tear down and rebuild the Audio instance.

