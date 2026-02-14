

# Replace Robotic Browser TTS with Gemini TTS

## Problem

The browser's built-in `speechSynthesis` sounds robotic and unnatural.

## Solution

Use Google's **Gemini 2.5 Flash TTS** model (`gemini-2.5-flash-preview-tts`) which produces high-quality, natural-sounding speech. Your `GEMINI_API_KEY` is already configured -- no new secrets needed.

## Changes

### 1. Update `supabase/functions/elevenlabs-tts/index.ts`

Repurpose the existing edge function to call **Gemini TTS** instead of ElevenLabs:

- Replace the ElevenLabs API call with a call to:
  ```
  https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent
  ```
- Use `GEMINI_API_KEY` instead of `ELEVENLABS_API_KEY`
- Request body format:
  ```json
  {
    "contents": [{ "parts": [{ "text": "Say cheerfully: <user text>" }] }],
    "generationConfig": {
      "response_modalities": ["AUDIO"],
      "speech_config": {
        "voice_config": {
          "prebuilt_voice_config": { "voice_name": "Kore" }
        }
      }
    }
  }
  ```
- Gemini returns base64-encoded PCM audio in the response JSON -- decode it and return as WAV/audio bytes
- Keep existing rate limiting and auth logic

### 2. Update `src/hooks/useVoiceChat.ts`

Switch back from browser `speechSynthesis` to fetching audio from the edge function:

- Restore the `TTS_URL` pointing to the same `elevenlabs-tts` endpoint (it now serves Gemini audio)
- Restore `audioRef` and the `fetch`-based `triggerTTS` that plays returned audio via `new Audio(blob)`
- Keep the conversation loop logic (auto-listen on `audio.onended`)

### What stays the same

- The conversation loop (silence detection, auto-send, auto-listen)
- The `useSpeechRecognition` hook
- The `VoiceOrb` and `LiveChat` components
- Rate limiting and auth in the edge function

## Technical Details

### Gemini TTS response format

The API returns JSON with inline audio data:
```json
{
  "candidates": [{
    "content": {
      "parts": [{ "inlineData": { "mimeType": "audio/wav", "data": "<base64>" } }]
    }
  }]
}
```

The edge function will decode the base64 audio and return raw audio bytes with `Content-Type: audio/wav`.

### Available Gemini TTS voices

Kore, Charon, Fenrir, Aoede, Puck, and others. Will default to **Kore** (clear, natural female voice).

| Action | File |
|--------|------|
| Modify | `supabase/functions/elevenlabs-tts/index.ts` -- replace ElevenLabs with Gemini TTS API |
| Modify | `src/hooks/useVoiceChat.ts` -- restore fetch-based TTS with audio playback |

