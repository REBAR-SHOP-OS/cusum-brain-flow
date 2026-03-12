

# Fix Pro Video Editor: Auto-advance, Timeline, Text/Audio Tracks

## Problems Identified

1. **Playback stops after each scene** — `onEnded` just sets `isPlaying(false)` instead of advancing to next clip
2. **Timeline playhead is per-clip, not global** — it only tracks the current single video's time, not cumulative position across all scenes
3. **"Add text" and "Add audio" buttons are non-functional placeholders** — they do nothing on click
4. **Voiceover/music don't auto-generate or appear in timeline** — no automatic creation or timeline integration

## Plan

### 1. Auto-advance playback across scenes (`ProVideoEditor.tsx`)
- In `onEnded`, auto-advance `selectedSceneIndex` to the next completed clip and auto-play it
- If no more clips, stop playback

### 2. Global timeline tracking (`ProVideoEditor.tsx` + `TimelineBar.tsx`)
- Compute cumulative start times for each scene based on segment durations
- Track a `globalTime` = sum of previous scenes' durations + currentTime of active clip
- Pass `globalTime` and `totalDuration` to TimelineBar instead of per-clip values
- Clicking the timeline should map the global position back to the correct scene + seek offset

### 3. Functional Text track (`TimelineBar.tsx` + new `TextOverlayDialog`)
- "Add text" opens a small dialog/popover to enter text, pick a scene, set position
- Adds a `VideoOverlay` with `kind: "text"` to the overlays state
- Show text entries as colored blocks on the Text track row

### 4. Functional Audio track with auto-voiceover (`TimelineBar.tsx` + `ProVideoEditor.tsx`)
- "Add audio" triggers auto-voiceover generation: calls `elevenlabs-tts` for each script segment sequentially, storing audio URLs
- Audio tracks appear as blocks on the Audio track row in TimelineBar
- During playback, the matching audio for the current scene plays in sync with the video
- Music generated in MusicTab also appears as a block spanning the full timeline

### Files to modify
- `src/components/ad-director/ProVideoEditor.tsx` — auto-advance, global time, text/audio overlay state, auto-voiceover generation
- `src/components/ad-director/editor/TimelineBar.tsx` — global playhead, functional text/audio track rows with visual blocks, click handlers
- New: `src/components/ad-director/editor/TextOverlayDialog.tsx` — simple dialog for adding text overlays
- `src/components/ad-director/editor/ScriptTab.tsx` — minor: wire "generate all voiceovers" button

### Technical details

**Auto-advance logic:**
```
onEnded → if (selectedSceneIndex < lastCompletedIndex) {
  setSelectedSceneIndex(prev => prev + 1);  // triggers videoSrc change
  // useEffect watches selectedSceneIndex and auto-plays
}
```

**Global time calculation:**
```
sceneDurations = clips.map(c => actual video duration or segment duration)
cumulativeStarts = [0, d0, d0+d1, ...]
globalTime = cumulativeStarts[selectedSceneIndex] + currentTime
totalDuration = sum(sceneDurations)
```

**Auto-voiceover:** One button "Generate All Voiceovers" calls TTS edge function for each segment's text, stores `{sceneId, audioUrl, duration}[]` in state, rendered as blocks on Audio track.

