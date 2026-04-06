

# Filter Background Noise from Vizzy Voice Transcription

## Problem
Vizzy picks up ambient sounds (TV, radio, other conversations) and transcribes them as user input. The screenshot shows Korean text and random English phrases appearing as "YOU" messages — these are clearly from background audio, not the user speaking directly.

## Root Cause
1. **VAD threshold still too permissive** for noisy environments — ambient audio from TV/radio passes the 0.75 threshold
2. **User transcript filter is too basic** — only blocks fragments < 3 words / 10 chars (line 263-264). Full sentences from TV audio pass through
3. **No language coherence check** — Korean or random English from TV gets accepted as valid user input
4. **Microphone not constrained** — no noise suppression or echo cancellation enabled in `getUserMedia`

## Changes

### 1. Enable hardware noise suppression (`src/hooks/useVoiceEngine.ts` ~line 364)

Change `getUserMedia({ audio: true })` to use advanced constraints:
```typescript
getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
})
```
This tells the browser to apply built-in DSP filtering before sending audio to the WebRTC connection.

### 2. Increase VAD threshold further (`src/hooks/useVizzyVoiceEngine.ts` ~line 494)

- `vadThreshold`: `0.75` → `0.85` (only strong, close-mic speech triggers)
- `silenceDurationMs`: `1200` → `1500` (longer silence needed to confirm turn)

### 3. Strengthen user transcript noise filter (`src/hooks/useVoiceEngine.ts` ~line 259-273)

Add additional filters for ambient noise detection in the `input_audio_transcription.completed` handler:
- **Non-target language filter**: Block transcripts containing Korean, Japanese, Chinese, or other non-target scripts (user speaks English or Farsi only)
- **TV/media pattern filter**: Block common broadcast phrases like "MBC", "news", "channel", subtitle-like text
- **Confidence-based length filter**: Raise minimum from 3 words to a smarter check — short fragments without Farsi characters that don't look like direct speech get blocked

### 4. Add prompt instruction about noise (`src/hooks/useVizzyVoiceEngine.ts` prompt)

Add to system prompt: "IGNORE any background noise, TV audio, radio, or conversations from other people. Only respond to direct speech addressed to you. If you detect ambient noise transcribed as input, discard it silently."

## Files Changed
- `src/hooks/useVoiceEngine.ts` — audio constraints + stronger transcript filtering
- `src/hooks/useVizzyVoiceEngine.ts` — higher VAD threshold + prompt update

