

# Upgrade "Generate" Button: Auto-Generate Text + Voiceover + Music Together

## Problem
Currently the "Generate" button only generates voiceovers and text overlays. Music is not included. The user wants clicking Generate to:
1. Clear all existing text overlays, voiceover tracks, and music tracks
2. Generate new voiceovers for all scenes (with matching text overlays)
3. Auto-generate background music using Lyria based on the video's theme
4. Replace all blue (text), teal (voiceover), and yellow (music) bars

## Changes — `src/components/ad-director/ProVideoEditor.tsx`

### 1. Rename `generateAllVoiceovers` → `generateAll` and expand it (~line 1314)
- At the start: clear ALL existing overlays (text kind), voiceover tracks, and music tracks
- Keep the existing voiceover generation loop (per-scene TTS)
- After voiceovers are done, auto-generate music:
  - Build a prompt from the video's segment texts (e.g., "Cinematic background music for a video about: [summary of segment texts]")
  - Call `lyria-music` edge function with that prompt and total video duration (capped at 60s)
  - Add the resulting music as a `kind: "music"` audio track
- Update text overlays via the existing `buildTimedOverlays` flow (already triggered by `voiceoverDurations` useEffect)
- All three (text, voice, music) replace their predecessors — no accumulation

### 2. Music prompt construction
```typescript
// Build music prompt from segment texts
const allTexts = segments.map(s => s.text).filter(Boolean).join(". ");
const musicPrompt = `Cinematic instrumental background music for a professional video about: ${allTexts.slice(0, 300)}`;
const totalDuration = segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
```

### 3. Clear old tracks at the start of generateAll
```typescript
// Clear everything before regenerating
setOverlays(prev => prev.filter(o => o.kind !== "text"));
setAudioTracks([]);  // Remove all voiceover + music tracks
```

### 4. Add music track after voiceovers
```typescript
// After voiceover loop, generate music
toast({ title: "🎵 در حال تولید موسیقی..." });
const musicResponse = await fetch(`${SUPABASE_URL}/functions/v1/lyria-music`, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ prompt: musicPrompt, duration: Math.min(totalDuration, 60) }),
});
if (musicResponse.ok) {
  const musicBlob = await musicResponse.blob();
  const musicUrl = URL.createObjectURL(musicBlob);
  newTracks.push({
    sceneId: "", label: "🎵 Background Music",
    audioUrl: musicUrl, kind: "music", globalStartTime: 0,
  });
}
```

### 5. Final setAudioTracks replaces ALL tracks (already does this partially)
```typescript
setAudioTracks(newTracks); // Contains both voiceover + music tracks
```

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — expand `generateAllVoiceovers` to also clear old tracks and generate music

## Result
- Clicking "Generate" clears old text/voice/music bars and creates fresh ones
- New blue (text), teal (voiceover), and yellow (music) bars appear together
- Music is auto-generated based on video content theme

