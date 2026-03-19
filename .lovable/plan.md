

# Fix Translation Accuracy and Speed for Nila Interpreter

## Problem Analysis

From the screenshot, the English column shows garbled text like "Hello from Washnit I am happy" and "Translation speed decreased" — these are clearly inaccurate translations. The root cause is **two-fold**:

1. **ElevenLabs Scribe has no language hint**: When the user selects EN or FA mic button, the `useScribe` hook is initialized with NO `language_code`. This means Scribe tries to auto-detect the language, often producing poor transcriptions especially for Farsi. Telling Scribe the exact language will dramatically improve transcription quality.

2. **Translation model can be upgraded**: Currently using `gemini-2.5-flash`. Upgrading to `gemini-2.5-pro` for better accuracy, or `gemini-3-flash-preview` for a balance of speed and accuracy.

## Changes

### 1. `src/hooks/useRealtimeTranscribe.ts` — Pass language hint to ElevenLabs Scribe

The `useScribe` hook needs to be re-initialized or reconnected with the correct language code when the user selects EN or FA. ElevenLabs Scribe supports language codes like `"eng"` and `"fas"` (ISO 639-3).

- When `sourceLang === "en"`, pass `languageCode: "eng"` to the scribe connection
- When `sourceLang === "fa"`, pass `languageCode: "fas"` to the scribe connection
- This single change should dramatically improve transcription accuracy

Since `useScribe` doesn't accept language at hook level, we need to disconnect and reconnect with the language parameter when the source language changes. Check if the `connect()` method accepts a language parameter, or if we need to pass it differently.

### 2. `supabase/functions/translate-message/index.ts` — Upgrade model + optimize prompt

- Change model from `gemini-2.5-flash` to `gemini-3-flash-preview` for better accuracy with similar speed
- Simplify the system prompt to reduce token count (faster processing)
- Remove the rate limit DB call overhead (or make it async/non-blocking)

### 3. `src/hooks/useRealtimeTranscribe.ts` — Reduce client-side filtering delay

- Relax the overly aggressive noise filters that may be discarding valid short Farsi phrases
- Farsi phrases can be very short but meaningful — reduce `wordCount < 3` to `wordCount < 2` and `trimmed.length < 10` to `trimmed.length < 5`

## Technical Details

### Files to modify:
- `src/hooks/useRealtimeTranscribe.ts` — language hint on Scribe connect, relaxed noise filters
- `supabase/functions/translate-message/index.ts` — upgraded model, streamlined prompt

### Key insight:
The biggest accuracy gain will come from telling ElevenLabs Scribe which language to expect. Without this, it's guessing and producing garbage transcriptions that no translation model can fix.

