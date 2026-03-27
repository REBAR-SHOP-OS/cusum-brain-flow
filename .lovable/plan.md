

# Sync Speed Control for Both Video and Audio

## Problem
Currently the speed control only sets `videoRef.current.playbackRate`. The voiceover audio (`audioRef.current`) is not affected, so audio and video go out of sync when speed is changed.

## Solution
Update the `useEffect` that applies `videoSpeed` to also set `audioRef.current.playbackRate`. Additionally, when creating new audio instances (in the voiceover setup logic), apply the current `videoSpeed` to the new audio element.

## Changes — single file

### `src/components/ad-director/ProVideoEditor.tsx`

1. **Existing speed effect (~line 737-741)**: Add `audioRef.current.playbackRate = videoSpeed` alongside the video playback rate assignment.

2. **Voiceover audio creation (~line 591)**: After `audioRef.current = a;`, set `a.playbackRate = videoSpeed` so newly created audio elements inherit the current speed.

## Files changed
- `src/components/ad-director/ProVideoEditor.tsx`

