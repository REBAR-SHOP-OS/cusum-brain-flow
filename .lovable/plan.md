

## Goal

Replace the OpenAI Realtime WebRTC voice engine with a **STT → Lovable AI → ElevenLabs TTS** pipeline for Vizzy Voice on `/vizzy-live`. This completely eliminates the WebRTC/ICE/TURN transport failures on mobile.

## Architecture

```text
Current (broken on mobile):
  Mic → WebRTC → OpenAI Realtime (GPT-4o-mini) → WebRTC → Speaker

New:
  Mic → Browser SpeechRecognition → vizzy-voice-chat (Lovable AI, streaming) → elevenlabs-tts → Speaker
```

## What already exists and will be reused

- **`vizzy-voice-chat` edge function** — already streams from Lovable AI gateway with system prompt support
- **`elevenlabs-tts` edge function** — already generates MP3 from text
- **`useNilaVoiceRelay` hook** — demonstrates the exact STT → process → TTS → audio-queue pattern we need
- **`VizzyVoiceChat` UI component** — keeps its transcript display, action parsing, mute/unmute, debug step display
- **`useVizzyVoiceEngine`** — keeps its context-fetching, instruction-building, and time-sync logic

## Implementation plan

### 1. Create `useVizzyStreamVoice` hook (new file)
Replace `useVizzyRealtimeVoice` with a simpler hook that:
- Uses `webkitSpeechRecognition` / `SpeechRecognition` for continuous STT (same pattern as existing voice features)
- On committed transcript: streams to `vizzy-voice-chat` edge function via SSE fetch
- Collects full response text, then sends to `elevenlabs-tts` for audio playback
- Manages an audio queue (reuse pattern from `useNilaVoiceRelay`)
- Exposes the same interface: `state`, `transcripts`, `isSpeaking`, `isMuted`, `partialText`, `startSession`, `endSession`, `toggleMute`, `updateSessionInstructions`, `sendFollowUp`, `debugStep`

### 2. Update `useVizzyVoiceEngine` 
- Change import from `useVizzyRealtimeVoice` to `useVizzyStreamVoice`
- Remove WebRTC-specific refs (relay retry, TURN servers, skip TURN)
- Keep all context-fetching and instruction-building logic unchanged

### 3. Update `vizzy-voice-chat` edge function
- Ensure it accepts the full system prompt from the client (it already does)
- No other changes needed — it already streams from Lovable AI

### 4. Minor cleanup in `VizzyVoiceChat` UI
- Remove `outputAudioBlocked` / `retryOutputAudio` references (WebRTC-specific)
- Remove WebRTC debug step display (replace with simpler status: "listening", "thinking", "speaking")
- Keep all VIZZY-ACTION parsing, auto-follow-up, transcript display unchanged

## What stays unchanged
- `vizzy-voice-chat` edge function (already works)
- `elevenlabs-tts` edge function (already works)
- `VizzyVoiceChat` UI layout, action parsing, transcript rendering
- `VizzyLive` page (prime audio + session start flow)
- All ERP/PersonaPlex/context logic in `useVizzyVoiceEngine`
- The full `VIZZY_INSTRUCTIONS` prompt

## Files changed
- `src/hooks/useVizzyStreamVoice.ts` — **new** (STT + LLM stream + TTS pipeline)
- `src/hooks/useVizzyVoiceEngine.ts` — swap import, remove WebRTC refs
- `src/components/vizzy/VizzyVoiceChat.tsx` — remove WebRTC-specific UI bits

## Files NOT changed
- `supabase/functions/vizzy-voice-chat/index.ts`
- `supabase/functions/elevenlabs-tts/index.ts`
- `src/hooks/useVizzyRealtimeVoice.ts` (kept for potential future use, just no longer imported)
- `src/pages/VizzyLive.tsx`

## Expected result
- No WebRTC, no ICE, no TURN, no SDP — zero transport-layer failure surface
- Works on any mobile network that can make HTTPS requests
- Slightly higher latency than true realtime (~2-4s for LLM + TTS) but 100% reliable
- Same Vizzy personality, same ERP actions, same transcript UI

## Technical details
- STT: `SpeechRecognition` API with `continuous=true`, `interimResults=true`, language auto-detect (en/fa)
- LLM: SSE stream from `vizzy-voice-chat`, parsed token-by-token for partial text display
- TTS: Full response sent to `elevenlabs-tts` after stream completes, audio queued and played
- Conversation history maintained as messages array passed to the edge function on each turn

