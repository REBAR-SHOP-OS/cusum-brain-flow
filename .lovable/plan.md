

# Auto-Translate Realtime Transcription to English

## Problem
The realtime transcription (ElevenLabs Scribe) outputs text in whatever language is spoken. The user wants it to always display in English, with accurate translation, regardless of the source language.

## Approach
Add an auto-translation step in `useRealtimeTranscribe.ts`: after each committed transcript arrives, send it to the `transcribe-translate` edge function for translation to English, then store the English text. Display both original and translated text in the `LiveTranscript` component.

## Changes

### 1. `src/hooks/useRealtimeTranscribe.ts`
- Add `translatedText` field to `CommittedTranscript` interface
- After each `onCommittedTranscript`, fire an async call to `transcribe-translate` with `mode: "text"`, `targetLang: "English"`, `sourceLang: "auto"`
- Update the transcript entry with the translated English text once received
- Show original text as fallback while translation is pending

### 2. `src/components/transcribe/LiveTranscript.tsx`
- Show the `translatedText` (English) as the primary display
- Show original text in a smaller, muted line below for reference
- Add a subtle "translating..." indicator while translation is pending

### 3. `src/components/office/TranscribeView.tsx`
- Update `getFullTranscript` usage: when populating `originalText` on disconnect, use translated texts so the final transcript is in English
- The existing "Translate" post-processing button remains for re-translation to other languages

## Technical Details
- Translation calls are fire-and-forget per segment (non-blocking)
- Each segment is ~1-3 sentences, so translation is fast
- Uses the existing 2-pass translation pipeline (Gemini 2.5 Pro) for high accuracy
- If translation fails, falls back to original text
- `CommittedTranscript` gains: `translatedText?: string`, `isTranslating?: boolean`

