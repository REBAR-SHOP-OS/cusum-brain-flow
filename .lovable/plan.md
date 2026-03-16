

# Fix: Transcription Accuracy & Clean Language Separation

## Problem
1. ElevenLabs Scribe transcribes Farsi speech but outputs phonetic English gibberish ("let me raise my hand, come, let me raise my leg")
2. The translation to both English and Farsi is inaccurate because the source text is already garbled
3. The main panel mixes languages; the right panel also shows mixed content

## Root Cause
The `translate-message` edge function uses a simple translation prompt that doesn't account for noisy/phonetic transcriptions. When ElevenLabs outputs English-phonetic approximations of Farsi speech, the AI translator just passes it through or produces poor translations.

## Solution

### 1. `supabase/functions/translate-message/index.ts` — Improve translation prompt
- Change the system prompt to instruct the AI to:
  - Detect the actual spoken language from context clues
  - Clean up phonetic/garbled transcriptions before translating
  - Filter out non-speech noise, filler words, and irrelevant sounds
  - Produce only clean, accurate text in the target language
- Add a `cleanTranscript` flag so the caller can request denoising

### 2. `src/hooks/useRealtimeTranscribe.ts` — Send both English + original language
- Instead of translating only to English, detect that the source might not be English and request the AI to:
  - Return the cleaned original-language text (what was actually said)
  - Return the English translation
- Store both `originalCleanText` (actual language) and `translatedText` (English) on each transcript entry

### 3. `src/components/transcribe/LiveTranscript.tsx` — Show English only
- Display `translatedText` (English) in the main panel
- Never show raw Scribe output directly (it's often garbled for non-English)

### 4. `src/components/office/TranscribeView.tsx` — Right panel shows target language only
- The right panel translation should use the cleaned original text as source (not the garbled Scribe output)
- Display only the target language text, without showing the raw English below it when the target is Farsi

## Technical Detail

The key change is in the translation prompt. Instead of:
```
"Translate this from X into Y"
```
It becomes:
```
"You are a speech-to-text post-processor and translator. The input is a raw transcription that may contain errors, phonetic approximations, or noise artifacts. First, understand the actual meaning of what was spoken. Then produce clean, accurate translations. Ignore filler words, background noise descriptions, and nonsensical fragments."
```

This ensures both the English main panel and the Farsi side panel show clean, meaningful text.

