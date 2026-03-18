

## Plan: Replace AZIN with OpenAI GPT Realtime WebRTC Interpreter

### What Changes

Replace the current ElevenLabs-based AZIN voice interpreter with OpenAI's Realtime API via WebRTC. This gives you ChatGPT-like real-time voice with sub-second latency, using the `GPT_API_KEY` you already have configured. No third-party SDK needed — just native browser WebRTC APIs.

### Architecture

```text
Browser (WebRTC)  ──audio──►  OpenAI Realtime API (gpt-realtime)
                  ◄──audio──  
                  ◄──events── (transcripts via data channel)

Edge Function: mint ephemeral token with GPT_API_KEY
```

### Changes

**1. Replace edge function: `supabase/functions/elevenlabs-azin-token/index.ts`**

Rewrite to call OpenAI's `/v1/realtime/client_secrets` endpoint using `GPT_API_KEY`. Returns an ephemeral key the browser uses to establish a WebRTC peer connection directly with OpenAI.

Session config includes:
- Model: `gpt-realtime`
- Voice: `alloy` (or user preference)
- System instructions: "You are a real-time interpreter. If you hear Farsi, respond with the English translation only. If you hear English, respond with the Farsi translation only. Never add explanations. Just translate. Be extremely fast."
- Input audio transcription enabled (for showing text in UI)

**2. Rewrite hook: `src/hooks/useAzinVoiceInterpreter.ts`**

Remove all ElevenLabs SDK dependency. Replace with native WebRTC:
- Fetch ephemeral token from edge function
- Create `RTCPeerConnection`
- Get user microphone, add audio track
- Create data channel `"oai-events"` for receiving transcripts
- POST SDP offer to `https://api.openai.com/v1/realtime/calls` with ephemeral key
- Set remote description from answer SDP
- Listen for server events on data channel:
  - `conversation.item.input_audio_transcription.completed` → user transcript
  - `response.audio_transcript.delta` / `response.audio_transcript.done` → agent translation transcript
- Audio output handled automatically by WebRTC (no manual audio element needed beyond initial setup)
- Track connection state, transcripts, speaking/listening mode

**3. Update component: `src/components/azin/AzinInterpreterVoiceChat.tsx`**

Minimal changes — adapt to new hook API:
- Remove ElevenLabs-specific volume methods (`getInputVolume`/`getOutputVolume`)
- Use simpler speaking/listening state from data channel events
- Keep existing UI (orb, transcripts, close button)

**4. No new secrets needed**

`GPT_API_KEY` is already configured. The edge function uses it to mint ephemeral tokens.

### Files
1. `supabase/functions/elevenlabs-azin-token/index.ts` — rewrite to OpenAI ephemeral token
2. `src/hooks/useAzinVoiceInterpreter.ts` — rewrite with native WebRTC
3. `src/components/azin/AzinInterpreterVoiceChat.tsx` — adapt to new hook API
4. Deploy edge function

