

# Mix Voice + Music Together in Final Export

## Problem
The MusicTab is completely isolated — tracks are stored in local state and never passed to the stitch pipeline. The `stitchClips` function only accepts a single `audioUrl` (voiceover). Music is never included in the final export.

## Changes

### 1. `src/components/ad-director/editor/MusicTab.tsx` — Expose selected track
- Accept an `onTrackSelect` callback prop: `(track: { url: string; name: string } | null) => void`
- Call it whenever `selectedTrack` changes so the parent knows which music track to mix

### 2. `src/components/ad-director/ProVideoEditor.tsx` — Lift music state
- Add `musicTrackUrl` state
- Pass `onTrackSelect` to `MusicTab` to capture the selected track URL
- Pass `musicTrackUrl` up via a new `onMusicSelect` callback prop

### 3. `src/lib/videoStitch.ts` — Mix two audio sources
- Add `musicUrl?: string` and `musicVolume?: number` to `StitchOverlayOptions`
- In the audio setup section, create a second `HTMLAudioElement` for music
- Use `AudioContext` to mix both sources (voice at full volume, music at ~0.3 volume) into a single `MediaStreamDestination`
- Add both audio tracks to the `combinedStream`

### 4. `src/components/ad-director/AdDirectorContent.tsx` — Pass music URL to stitch
- Add `musicTrackUrl` state
- Pass it as `onMusicSelect` callback to `ProVideoEditor`
- In `handleExport`, pass `musicUrl: musicTrackUrl` to the `stitchClips` call alongside `audioUrl`

## Audio Mixing Architecture
```text
Voice (HTMLAudioElement) ─→ GainNode(1.0) ─┐
                                            ├─→ MediaStreamDestination ─→ MediaRecorder
Music (HTMLAudioElement) ─→ GainNode(0.3) ─┘
```

## Files Modified
- `src/components/ad-director/editor/MusicTab.tsx` — add `onTrackSelect` prop
- `src/components/ad-director/ProVideoEditor.tsx` — lift music state, pass to parent
- `src/lib/videoStitch.ts` — mix voice + music via dual AudioContext sources
- `src/components/ad-director/AdDirectorContent.tsx` — pass music URL into stitch pipeline

