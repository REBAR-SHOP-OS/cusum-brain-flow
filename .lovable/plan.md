
# Fix Voice Chat TTS -- "She's Not Talking Back"

## Root Cause

Two separate issues are preventing audio playback:

1. **Gemini TTS 400 Error**: The added instruction prefix (`"TTS the following text verbatim..."`) is causing the Gemini TTS model to attempt text generation instead of audio generation. The model's error message is explicit: "Make sure your instructions are clear to only generate audio from a given text transcript." The fix is to send ONLY the raw transcript text with no instructions -- the `response_modalities: ["AUDIO"]` config already tells the model to produce audio.

2. **Browser Audio Playback Failure**: The Gemini TTS API returns `audio/wav` (raw PCM/WAV), but the blob URL created from this response triggers `NotSupportedError: Failed to load because no supported source was found` in some browsers. The fix is to convert the raw audio bytes to a proper WAV file with headers on the server side, or explicitly set the blob type to match the actual MIME type.

## Changes

### 1. `supabase/functions/elevenlabs-tts/index.ts`

- **Remove the instruction prefix** from the text sent to Gemini TTS. Send only the raw transcript: `text.trim()` instead of the instruction-wrapped version. The `response_modalities: ["AUDIO"]` + `speech_config` already forces audio-only output.
- **Strip markdown** from the input text before sending to TTS (remove `**`, `*`, `#`, `[]()` link syntax) so the model reads clean text.
- **Add WAV header** to the raw PCM audio bytes returned by Gemini. The API returns raw linear PCM data labeled as `audio/wav` but sometimes without proper WAV headers, causing browser playback to fail. Wrap the bytes in a valid RIFF/WAV header with correct sample rate (24kHz, 16-bit, mono -- Gemini's default output format).
- **Always return `audio/wav`** with the proper Content-Type header.

### 2. `src/hooks/useVoiceChat.ts`

- **Improve error handling** in `triggerTTS`: when the fetch response is not OK, log the response body for debugging instead of silently failing.
- **On audio error**, log the error details so future issues are easier to diagnose.
- **Don't kill conversation on TTS failure**: Instead of setting status to "idle" when TTS fails, transition back to "listening" so the conversation can continue (the text response is already visible).

## Technical Details

### WAV Header Construction

Gemini TTS returns raw linear16 PCM at 24000 Hz, mono, 16-bit. The WAV header is a 44-byte RIFF header:

```text
Bytes 0-3:   "RIFF"
Bytes 4-7:   file size - 8
Bytes 8-11:  "WAVE"
Bytes 12-15: "fmt "
Bytes 16-19: 16 (PCM format chunk size)
Bytes 20-21: 1 (PCM format)
Bytes 22-23: 1 (mono)
Bytes 24-27: 24000 (sample rate)
Bytes 28-31: 48000 (byte rate)
Bytes 32-33: 2 (block align)
Bytes 34-35: 16 (bits per sample)
Bytes 36-39: "data"
Bytes 40-43: data size
```

### Markdown Stripping

Simple regex to clean text before TTS:
- Remove `**bold**` and `*italic*` markers
- Remove `[link text](url)` -> keep "link text"
- Remove `#` heading markers
- Remove bullet markers (`- `, `* `)

## Files to Modify

| Action | File |
|--------|------|
| Modify | `supabase/functions/elevenlabs-tts/index.ts` |
| Modify | `src/hooks/useVoiceChat.ts` |
