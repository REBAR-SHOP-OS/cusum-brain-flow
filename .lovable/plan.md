

# Add Dedicated "Music" Track Row (Yellow) to Timeline

## Problem
Music tracks are currently mixed into the "Audio" row alongside voiceovers. The user wants a separate, always-visible "Music" row with yellow bars.

## Changes — `src/components/ad-director/editor/TimelineBar.tsx`

### 1. Add a new "🎵 Music" track row after the Audio row (~line 977)
- Filter `audioTracks` to separate music (`kind === "music"`) from non-music (voiceover)
- Render the existing Audio row with only voiceover tracks
- Add a new row labeled "Music" that always renders (even when empty, showing a placeholder)
- Yellow bar color: `bg-yellow-500/60 hover:bg-yellow-500/80`
- Same drag, click, delete, and volume behavior as the audio row

### 2. Always show the Music row
Unlike Text and Audio rows which hide when empty, the Music row will always be visible with a subtle "No music" placeholder when no music track exists — making it clear that music can be added.

### 3. Split audioTracks rendering
```
const musicTracks = audioTracks.filter(t => t.kind === "music");
const voiceoverTracks = audioTracks.filter(t => t.kind !== "music");
```
- Existing Audio row renders `voiceoverTracks` only
- New Music row renders `musicTracks` with yellow bars

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — split audio/music, add yellow Music row

## Result
A dedicated yellow "Music" row always visible in the timeline, clearly separated from voiceover audio tracks.

