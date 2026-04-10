
# Fix Persian Understanding in Vizzy Voice

## Root cause
The real failure is in speech-to-text, not in Vizzy’s reply logic.

Right now:
- `useVizzyGeminiVoice.ts` uses `useSpeechRecognition`
- `useSpeechRecognition.ts` explicitly does **not** set `recognition.lang`
- `useVizzyVoiceEngine` exposes `lang`, but that value is effectively unused for browser STT
- so the recent “reply in the same language” fix only changes AI/TTS after transcription, while Persian is already being lost before Vizzy sees it

## Plan

### 1. Replace the fragile browser STT path for Vizzy voice
Refactor Vizzy voice input to use the existing real-time ElevenLabs transcription flow instead of Web Speech API.

Why:
- the project already uses this successfully in `useRealtimeTranscribe.ts`
- it supports Persian much more reliably
- this is the cleanest root fix instead of patching browser auto-detect behavior

### 2. Add a real language mode for voice input
Keep **Auto** as default, but add a small mode switch in the voice UI:
- Auto
- فارسی
- English

Behavior:
- Auto → let realtime STT auto-detect
- فارسی → force Persian STT (`fas`)
- English → force English STT (`eng`)

This gives a reliable fallback for short Persian phrases that auto-detection can miss.

### 3. Preserve current Vizzy pipeline
Keep these parts intact:
- Vizzy Brain / pre-digest context
- multilingual prompt instructions
- multilingual TTS voice switching
- action execution and live tool results
- pause-listening-while-speaking behavior

Only the speech input layer changes.

### 4. Files to update
- `src/hooks/useVizzyGeminiVoice.ts`
  - replace `useSpeechRecognition` with realtime Scribe handling
  - keep turn-taking, queueing, transcripts, and TTS flow
- `src/hooks/useVizzyVoiceEngine.ts`
  - change `lang` state into a real STT mode (`auto | fa | en`) and pass it through cleanly
- `src/components/vizzy/VizzyVoiceChat.tsx`
  - add small Auto / فارسی / English controls
  - optionally show partial live transcript while listening
- `src/hooks/useSpeechRecognition.ts`
  - likely no longer used by Vizzy voice; leave untouched unless cleanup is needed

## Validation
After implementation, verify end-to-end:
1. Speak Persian → transcript shows Persian correctly
2. Vizzy answers in Persian
3. Speak English right after → transcript switches correctly and reply is English
4. Brain-backed items like company rules still work in voice mode
5. No self-feedback loop during TTS playback
6. Mobile and desktop both still start/stop correctly

## Technical notes
- No database changes needed
- Existing `elevenlabs-scribe-token` function can be reused
- This is a minimal-scope architectural fix: swap the STT layer, keep the rest of Vizzy voice intact
