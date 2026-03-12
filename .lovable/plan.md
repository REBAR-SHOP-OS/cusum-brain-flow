

# Fix: Voiceover Plays Twice

## Root Cause
The voiceover sync effect (line 219-259 in `ProVideoEditor.tsx`) has two issues:
1. `audioTracks` is NOT in the dependency array — the effect uses stale closure data and doesn't properly restart when tracks change
2. The effect creates a `new Audio()` on every dependency change without checking if the same voiceover is already playing, which can cause overlapping playback during scene transitions

## Fix — `src/components/ad-director/ProVideoEditor.tsx`

**Refactor the voiceover sync effect (lines 219-259):**
- Track the current voiceover URL in a ref (`currentVoUrlRef`) to avoid recreating Audio when the same track is already playing
- Add `audioTracks` to the dependency array so the effect properly reacts to voiceover generation/changes
- Always pause and nullify `audioRef.current` before creating a new Audio instance (defensive cleanup)
- Skip re-creation if `audioRef.current.src` already matches the current voiceover URL and audio is not paused

```text
Before:
  useEffect → creates new Audio(vo.audioUrl) every time deps change
  deps: [selectedSceneIndex, isPlaying, isMuted, mutedScenes]  ← missing audioTracks

After:
  useEffect → checks if same URL is already playing, skips if so
  deps: [selectedSceneIndex, isPlaying, isMuted, mutedScenes, audioTracks]
  cleanup always pauses audioRef.current before re-entry
```

Single file edit, no backend changes.

