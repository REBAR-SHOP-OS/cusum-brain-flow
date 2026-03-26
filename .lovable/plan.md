

# Sync Text Overlays with Voiceover Audio (Subtitle-Style)

## Problem
Currently, text overlays show the full script text statically for the entire scene. The user wants the text to appear **synchronized with the voiceover** — like subtitles that show words/phrases as the audio plays them.

## Approach

Split each scene's voiceover text into short phrases (caption chunks), calculate timing for each chunk based on voiceover duration, and render only the current chunk based on `currentTime` during playback.

## Changes

### 1. `src/types/videoOverlay.ts` — Add timing fields

Add optional `startTime` and `endTime` fields to `VideoOverlay`:
```ts
startTime?: number; // seconds within the scene
endTime?: number;   // seconds within the scene
```

### 2. `src/components/ad-director/ProVideoEditor.tsx` — Generate timed caption chunks

**Replace** the existing auto-seed text overlay logic (lines 233-256) with a new version that:
- Splits each segment's voiceover text into short phrases (~4-6 words each)
- Calculates `startTime` and `endTime` for each chunk proportionally based on voiceover duration (from `voiceoverDurations` state) or clip duration
- Creates one `VideoOverlay` per chunk with timing data

**Update** the overlay rendering (lines 1173-1192) to filter `sceneOverlays` — only show text overlays where `currentTime` falls between `startTime` and `endTime`.

### 3. Re-generate text overlays when voiceovers complete

After `generateAllVoiceovers` finishes and `voiceoverDurations` are populated, re-seed the text overlays with proper timing. Add a `useEffect` that watches `voiceoverDurations` changes and regenerates text overlays with accurate timing.

### 4. Subtitle-style rendering

Change the text overlay visual style to be more subtitle-like:
- Centered at bottom of video (`position: { x: 5, y: 82 }`, `size: { w: 90, h: 12 }`)
- Semi-transparent dark background bar
- Fade-in/out transition between chunks

## Text Splitting Logic

```
"A 3D animation showcases various stirrup rebar configurations forming the skeletal structure of a concrete beam"
→ Chunk 1 (0s-3s): "A 3D animation showcases various"
→ Chunk 2 (3s-6s): "stirrup rebar configurations forming"  
→ Chunk 3 (6s-9s): "the skeletal structure of a concrete beam"
```

Timing is proportional: `chunkStart = (chunkIndex / totalChunks) * voDuration`

| File | Change |
|---|---|
| `videoOverlay.ts` | Add `startTime?` and `endTime?` fields |
| `ProVideoEditor.tsx` | Split text into timed chunks, render only active chunk based on currentTime |

