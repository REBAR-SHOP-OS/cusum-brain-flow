

# Fix: Voiceover Glitching During Playback

## Root Causes Found

1. **Cleanup destroys audio then recreates it**: When `mutedScenes` (or any dep) changes, React calls the cleanup function which **pauses and nullifies** `audioRef.current`. The effect then re-runs, finds no audio playing, and creates a brand-new `Audio` instance — causing an audible restart/glitch.

2. **The "same URL playing" guard is bypassed by cleanup**: Line 264 checks `audioRef.current` but cleanup already set it to `null`. So the guard never triggers on re-runs.

3. **Time sync too aggressive**: The `timeupdate` sync handler corrects drift at 0.3s threshold, causing audible jumps on minor buffering.

4. **Static card voiceover syncs to nonexistent video**: For static cards, `videoRef.current?.currentTime` is meaningless, setting wrong start time.

## Solution — `src/components/ad-director/ProVideoEditor.tsx`

### A. Separate muting from creation/destruction
Remove `mutedScenes` from the main playback effect deps. Instead, handle scene muting in the existing volume effect (line 412-418) — just set `audioRef.current.volume = 0` when muted.

### B. Protect audio from unnecessary teardown
In the cleanup function, **don't** null out `audioRef.current` unless `cancelled` was explicitly set by a real scene/play-state change. Use a separate `shouldDestroy` flag.

Actually, simpler approach: **move the "same URL" check before the `let cancelled` flag**, and return a no-op cleanup if audio should keep playing.

### C. Increase drift threshold
Change `0.3` → `0.5` seconds to avoid audible correction jumps.

### D. Handle static card voiceover start time
When `isStaticCard`, start voiceover at `currentTime` from the static card timer, not `videoRef.current?.currentTime`.

### Concrete changes

**Main playback effect (lines 240-303)** — rewrite:

```typescript
useEffect(() => {
  const sceneId = storyboard[selectedSceneIndex]?.id;
  const vo = currentSceneVoRef.current;

  // If same VO is already playing, don't touch it
  if (audioRef.current && currentVoUrlRef.current === vo?.url && !audioRef.current.paused) {
    return; // No cleanup — keep playing
  }

  let cancelled = false;
  let syncHandler: (() => void) | null = null;
  let vid: HTMLVideoElement | null = null;

  const cleanup = () => {
    cancelled = true;
    if (voDebounceRef.current) { clearTimeout(voDebounceRef.current); voDebounceRef.current = null; }
    if (vid && syncHandler) vid.removeEventListener("timeupdate", syncHandler);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
    currentVoUrlRef.current = null;
  };

  if (sceneTransitioning.current) { cleanup(); return cleanup; }

  if (!vo || !isPlaying || isMuted) { cleanup(); return cleanup; }

  // Clean up previous
  if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }

  voDebounceRef.current = setTimeout(() => {
    if (cancelled) return;
    const a = new Audio(vo.url);
    // For static cards, start at 0; for video, sync to video time
    a.currentTime = isStaticCard ? 0 : (videoRef.current?.currentTime ?? 0);
    const sceneClipDur = clipDurations[sceneId!];
    const sceneVoDur = voiceoverDurations[sceneId!];
    if (sceneClipDur && sceneVoDur && sceneVoDur > sceneClipDur) {
      a.playbackRate = Math.min(sceneVoDur / sceneClipDur, 1.3);
    } else {
      a.playbackRate = 1;
    }
    // Apply muted-scene volume
    if (sceneId && mutedScenes.has(sceneId)) {
      a.volume = 0;
    }
    a.play().catch(() => {});
    audioRef.current = a;
    currentVoUrlRef.current = vo.url;

    // Sync only for video scenes, not static cards
    if (!isStaticCard && videoRef.current) {
      syncHandler = () => {
        if (audioRef.current && videoRef.current) {
          const drift = Math.abs(audioRef.current.currentTime - videoRef.current.currentTime);
          if (drift > 0.5) audioRef.current.currentTime = videoRef.current.currentTime;
        }
      };
      vid = videoRef.current;
      vid.addEventListener("timeupdate", syncHandler);
    }
  }, 150);

  return cleanup;
}, [selectedSceneIndex, isPlaying, isMuted]);
// Removed mutedScenes from deps — handled via volume effect
```

**Volume effect (lines 412-418)** — also handle mutedScenes:
```typescript
useEffect(() => {
  if (audioRef.current) {
    const sceneId = storyboard[selectedSceneIndex]?.id;
    const isMutedScene = sceneId ? mutedScenes.has(sceneId) : false;
    if (isMutedScene) {
      audioRef.current.volume = 0;
    } else {
      const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
      audioRef.current.volume = vo?.volume ?? 1;
    }
  }
}, [audioTracks, selectedSceneIndex, storyboard, mutedScenes]);
```

### Summary
| Issue | Fix |
|-------|-----|
| Audio destroyed on every dep change | Early return if same URL playing |
| `mutedScenes` change restarts audio | Remove from deps, handle via volume |
| Drift sync too tight (0.3s) | Increase to 0.5s |
| Static card wrong start time | Use 0 instead of videoRef.currentTime |
| Static card sync to video | Skip timeupdate listener |

