

# Switch Vizzy Voice Engine from OpenAI Realtime to Gemini 2.5 Flash

## Why the current approach fails
OpenAI's `gpt-4o-mini-realtime-preview` model returns **500 errors** during SDP handshake — a server-side issue at OpenAI. Rather than wait for OpenAI to fix it, we replace the entire engine with Gemini.

## Architecture Change

```text
CURRENT (broken):
  Mic → WebRTC → OpenAI Realtime (SDP/ICE) → WebRTC audio out
  
NEW:
  Mic → Browser SpeechRecognition (STT) → Gemini 2.5 Flash (text) → ElevenLabs TTS → Audio playback
```

Gemini has no WebRTC realtime API, so we use a **STT → LLM → TTS** pipeline. All three pieces already exist in the project:
- **STT**: Browser's built-in `webkitSpeechRecognition` (free, instant, no API key)
- **LLM**: Gemini 2.5 Flash via Lovable AI gateway (already configured)
- **TTS**: ElevenLabs `elevenlabs-tts` edge function (already deployed)

## Plan

### 1. New edge function: `vizzy-voice-chat`
A streaming chat endpoint using Lovable AI gateway with `google/gemini-2.5-flash`. Receives conversation messages + system prompt (Vizzy instructions + ERP context). Returns streamed text response (SSE).

### 2. New hook: `useVizzyGeminiVoice`
Replaces the WebRTC-based `useVoiceEngine` with a simpler pipeline:
- Uses `webkitSpeechRecognition` for continuous listening (supports EN + FA)
- On speech commit → sends to `vizzy-voice-chat` edge function
- Streams response text → sends to `elevenlabs-tts` for audio playback
- Manages audio queue (same pattern as existing `useNilaVoiceRelay`)
- Keeps all existing Vizzy context loading (pre-digest, brain memories, time sync)

### 3. Update `useVizzyVoiceEngine.ts`
- Remove OpenAI model config (`gpt-4o-mini-realtime-preview`)
- Wire to new Gemini-based hook instead of `useVoiceEngine`
- Keep all existing context building (instructions, brain, ERP digest)

### 4. Update `VizzyVoiceChat.tsx`
- Remove WebRTC-specific UI (SDP phase labels, ICE diagnostics)
- Simplify connection states (no more `negotiating_sdp`, `waiting_channel`)
- Keep existing transcript display, action handling, and styling

### 5. Cleanup
- Remove `voice-engine-token` dependency for Vizzy (keep if used elsewhere)
- Remove WebRTC imports from Vizzy path

## Files Changed
| File | Action |
|------|--------|
| `supabase/functions/vizzy-voice-chat/index.ts` | **Create** — Gemini streaming chat |
| `src/hooks/useVizzyGeminiVoice.ts` | **Create** — STT + LLM + TTS pipeline |
| `src/hooks/useVizzyVoiceEngine.ts` | **Edit** — Use new Gemini hook |
| `src/components/vizzy/VizzyVoiceChat.tsx` | **Edit** — Simplify connection UI |

## Trade-offs
- **Slightly higher latency** (~1-2s vs WebRTC's sub-second) due to STT→API→TTS roundtrip
- **More reliable** — no WebRTC/SDP/ICE issues, no OpenAI server failures
- **Lower cost** — Gemini 2.5 Flash is significantly cheaper than OpenAI Realtime
- **Same voice quality** — ElevenLabs TTS (shimmer equivalent voice already configured)

