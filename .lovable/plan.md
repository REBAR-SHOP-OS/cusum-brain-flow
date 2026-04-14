

## Fix: Give Vizzy her voice back

### Problem
The `personaplex-voice` fallback (Lovable AI) returns `audio_base64: null`. The client falls back to `window.speechSynthesis` (browser TTS), which is unreliable on mobile Safari and often produces no audio output at all.

### Solution
Replace the browser `speechSynthesis` fallback with a call to the existing `elevenlabs-tts` edge function, which already works and returns high-quality MP3 audio. The client will fetch TTS audio as a blob, create an object URL, and play it through the audio queue system that already exists.

### Files changed

**`src/hooks/useVizzyStreamVoice.ts`**
- Replace `speakWithBrowserTTS` with `speakWithElevenLabs` — calls the `elevenlabs-tts` edge function, receives MP3 binary, creates a blob URL, and plays via the existing audio queue (`playNextAudio`).
- Use the primed mobile audio element (from `takePrimedMobileAudio`) for the first playback to satisfy iOS autoplay restrictions.
- Keep `window.speechSynthesis.cancel()` in `endSession` for cleanup safety.

### Flow after fix
```text
User speaks → Browser STT → personaplex-voice (text response)
                                    ↓
                        audio_base64 present? → play it
                        audio_base64 null?    → call elevenlabs-tts → play MP3
```

### What stays unchanged
- Transport architecture
- UI design
- ERP schema
- Anti-fabrication guardrails
- Greeting behavior
- Prompt structure

