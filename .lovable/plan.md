

# Vizzy Live → OpenAI Realtime Voice via WebRTC

## Goal
Replace the browser STT → Gemini → browser TTS pipeline on `/vizzy-live` with OpenAI's native Realtime API over WebRTC. True voice-to-voice — no intermediate text conversion, dramatically lower latency, human-quality voice.

## Architecture

```text
Current:  Mic → Browser SpeechRecognition → vizzy-voice-chat (Gemini) → Browser SpeechSynthesis → Speaker
New:      Mic → WebRTC → OpenAI Realtime (GPT-4o-mini) → WebRTC → Speaker
```

## Prerequisites (confirmed)
- `GPT_API_KEY` secret: configured
- `voice-engine-token` edge function: exists, creates ephemeral sessions
- `realtimeConnection.ts` WebRTC helpers: exist (STUN servers, ICE gathering)

## Changes

### 1. New: `src/hooks/useVizzyRealtimeVoice.ts`
WebRTC hook for OpenAI Realtime API:
- Fetches ephemeral token from `voice-engine-token` with full Vizzy instructions
- Creates `RTCPeerConnection` using existing helpers in `src/lib/webrtc/realtimeConnection.ts`
- Captures mic via `getUserMedia`, adds audio track to peer connection
- Opens data channel for events — listens for `response.audio_transcript.done` and `conversation.item.input_audio_transcription.completed` to populate transcript UI
- Parses `[VIZZY-ACTION]` tags from transcripts (same as current)
- Supports `session.update` via data channel for live instruction pushes (tool results)
- Exposes same interface as `useVizzyGeminiVoice`: `state`, `transcripts`, `isSpeaking`, `isMuted`, `toggleMute`, `startSession`, `endSession`, `partialText`, `sendFollowUp`, `updateSessionInstructions`

### 2. Update: `src/hooks/useVizzyVoiceEngine.ts`
- Swap `useVizzyGeminiVoice` import for `useVizzyRealtimeVoice`
- Pass instructions to the token endpoint (instead of lazily via `getSystemPrompt`)
- `appendLiveResult` sends `session.update` on the data channel instead of rebuilding prompt string
- All context fetching (pre-digest, daily-brief, brain memories) stays identical
- Time sync interval stays

### 3. Update: `supabase/functions/voice-engine-token/index.ts`
- Change default voice from `alloy` to `sage`

### 4. No changes to
- `VizzyVoiceChat.tsx` — interface-compatible
- `VizzyLive.tsx` — renders `VizzyVoiceChat` unchanged
- `useVizzyGeminiVoice.ts` — kept for `/vizzy-voice` standalone page
- Database, RLS, other edge functions

## Files
| File | Action |
|------|--------|
| `src/hooks/useVizzyRealtimeVoice.ts` | Create |
| `src/hooks/useVizzyVoiceEngine.ts` | Edit (swap engine) |
| `supabase/functions/voice-engine-token/index.ts` | Edit (default voice) |

## Risks
- OpenAI Realtime API availability — existing `voice-engine-token` already handles 5xx retries and returns `fallback: true` signal
- Ephemeral token expiry (~60s) — session persists beyond token lifetime; only needs token at connect time
- Mobile browser WebRTC support — well-supported on iOS Safari 14.5+ and all modern Android browsers

