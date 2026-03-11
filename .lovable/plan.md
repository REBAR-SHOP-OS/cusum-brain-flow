

## Plan: Add Audio/Music Generation for Videos + Fix Timeout

### Problem
1. Multi-scene video generation times out — the `poll-multi` downloads all scene clips sequentially in a single edge function invocation, which can exceed the execution time limit for 4+ scenes.
2. No audio/music generation — videos lack background music or sound effects.

### Fix 1: Reduce timeout risk in poll-multi

The current `poll-multi` action downloads ALL scene clips and uploads them to storage in one request. For 4+ scenes this easily exceeds edge function timeouts. 

**Solution**: Download and upload each clip individually as it completes (progressive upload), rather than waiting until all are done. When polling, if a scene is completed and hasn't been uploaded yet, upload it immediately and store the URL. Only return `sceneUrls` when all scenes are uploaded.

**Change in `generate-video/index.ts`**:
- When a scene completes during `poll-multi`, download + upload it immediately and return its URL in the response
- Client tracks which scenes already have URLs and sends them back on next poll
- Final poll just returns the accumulated `sceneUrls` without needing to download anything

This distributes the heavy download/upload work across multiple poll requests instead of one.

### Fix 2: Add Audio Generator using ElevenLabs

The project already has `ELEVENLABS_API_KEY` configured and an existing `elevenlabs-tts` edge function.

**New edge function**: `supabase/functions/elevenlabs-music/index.ts`
- Calls ElevenLabs Music API (`/v1/music`) to generate background music from a text prompt
- Also supports sound effects via `/v1/sound-generation`
- Returns binary audio (MP3)

**UI changes in `VideoGeneratorDialog.tsx`**:
- Add an "Audio" section after video completes with two options:
  - **Generate Music**: Text prompt → background music track (e.g. "upbeat corporate background music")
  - **Generate SFX**: Text prompt → sound effect
- Auto-suggest music prompt based on the video prompt using a simple mapping
- Preview audio with play/pause controls
- "Merge" button that combines video + audio on the client using canvas + MediaRecorder (similar to watermark approach)

**New utility**: `src/lib/videoAudioMerge.ts`
- Takes a video blob URL + audio blob URL
- Uses `<video>` + `<audio>` + `canvas.captureStream()` + `MediaRecorder` to produce a combined output
- Returns a blob URL of the merged video with audio

### File Changes

| File | Change |
|------|--------|
| `supabase/functions/elevenlabs-music/index.ts` | **New** — ElevenLabs music + SFX generation edge function |
| `supabase/functions/generate-video/index.ts` | Modify `poll-multi` to accept already-uploaded scene URLs and progressively upload clips |
| `src/lib/videoAudioMerge.ts` | **New** — Client-side video + audio merge utility |
| `src/components/social/VideoGeneratorDialog.tsx` | Add audio generation UI after video completes; integrate merge functionality |

### No database changes needed

