

## Plan: Integrate Near-Realtime Chunked TTS into Vizzy Voice

### What we're building
Replace the single-shot browser TTS fallback with chunked TTS via the external Phase 7 TTS server. When Vizzy One returns text-only (no `audio_base64`), the reply gets split into sentence chunks, each fetched as audio from a new `vizzy-tts` edge function, and queued for seamless playback. First audio plays in ~1s instead of waiting for the full reply.

### Changes

**1. New file: `src/utils/chunkText.ts`**
Text chunking utility — splits on `.!?`, groups into ~120 char chunks of 1–2 sentences. Strips `[VIZZY-ACTION]` blocks before chunking.

**2. New edge function: `supabase/functions/vizzy-tts/index.ts`**
Proxies `{ text }` → `http://100.86.84.110:9009` (the HTTP CORS bridge to Phase 7 TTS). Returns the audio blob directly. Uses the shared `requestHandler` with `authMode: "required"`, `rawResponse: true`. The TTS URL will be stored as a secret (`TTS_API_URL`).

**3. Patch: `src/hooks/useVizzyStreamVoice.ts`**
- Import `chunkText`
- Add `speakRealtime(text)`: chunks text → for each chunk, fetches audio from `vizzy-tts` edge function → creates `Audio` element → pushes to existing `audioQueueRef` → calls `playNextAudio()`. Generation runs ahead of playback so chunks overlap.
- Add `stopSpeech()`: clears queue, stops current audio, revokes URLs. Called from `endSession`.
- Replace `speakWithBrowserTTS(speakable)` calls (lines 196 and 388) with `speakRealtime(speakable)`
- Keep `playBase64Audio` path unchanged for when Vizzy One returns native audio

### File summary

| File | Action |
|---|---|
| `src/utils/chunkText.ts` | New |
| `supabase/functions/vizzy-tts/index.ts` | New |
| `src/hooks/useVizzyStreamVoice.ts` | Patch — replace browser TTS fallback with chunked realtime TTS |

### What does NOT change
- STT (browser SpeechRecognition) — unchanged
- `personaplex-voice` edge function — unchanged
- System prompt / brain context flow — unchanged
- UI layout, styling, animations — unchanged
- Audio path when Vizzy One returns `audio_base64` — unchanged
- Session lifecycle — unchanged

### Secret needed
`TTS_API_URL` = `http://100.86.84.110:9009` — will prompt user to set via secrets tool.

