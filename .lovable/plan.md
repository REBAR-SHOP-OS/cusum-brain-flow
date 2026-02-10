
# World-Class Transcription & Translation Upgrade

## Overview

Upgrade both the backend AI engine and frontend to deliver the most accurate, production-grade transcription and translation possible. This means using the most powerful AI model, a two-pass verification pipeline, confidence scoring, and smarter speech capture on the frontend.

## Backend Upgrades (`supabase/functions/transcribe-translate/index.ts`)

### 1. Upgrade AI Model to Gemini 2.5 Pro
Switch from `google/gemini-3-flash-preview` to `google/gemini-2.5-pro` -- the most powerful model available for translation accuracy, nuance, and context understanding.

### 2. Two-Pass Verification Pipeline
- **Pass 1**: Translate with the full context, domain hints, and formality constraints
- **Pass 2**: A second AI call reviews the translation for accuracy, grammar, and cultural nuance, returning a refined version and a confidence score (0-100)
- This catches mistranslations, awkward phrasing, and domain-specific errors that a single pass would miss

### 3. Enhanced System Prompt
Upgrade the prompt to act as a professional-grade translator with:
- Preservation of proper nouns, numbers, measurements, and technical terms
- Handling of idioms and cultural context (translate meaning, not word-for-word)
- Transliteration hints for names/places
- Explicit instruction to never hallucinate or add content not in the original

### 4. Return Confidence Score
Add a `confidence` field (0-100) to the response so the UI can show the user how reliable the translation is.

### 5. Add `targetLang` Support
Allow translating to any language (not just English). Default remains English but the user can pick a target.

## Frontend Upgrades (`src/components/office/TranscribeView.tsx`)

### 1. Batch Translation on Stop (Fix Current Bug Properly)
Replace the fragile `setTimeout` + `setOriginalText` callback hack with a proper ref-based approach:
- Accumulate all speech text in a `ref` (not just state)
- On stop, immediately read the ref and call the API with the full accumulated text
- No timing issues, no race conditions

### 2. Confidence Score Display
- Show a color-coded confidence badge next to the translation (green >= 90, yellow >= 70, red < 70)
- If confidence is below 70, show a "Re-translate" button that runs the verification pass again

### 3. Target Language Selector
- Add a "Translate To" dropdown (default: English) in the Advanced Options
- Supports all 30+ languages already defined

### 4. Improved Mic UX
- Show a live word counter while listening
- Show elapsed recording time
- Disable the stop button for the first 1 second to prevent accidental taps

### 5. Auto-Translate on Stop
When the user stops the mic, always translate the full accumulated text (not chunk-by-chunk). This gives the AI full context for a much more accurate translation.

## Technical Details

### Edge Function Changes

The function will make two sequential AI calls:

```text
Request --> Pass 1 (Translate with gemini-2.5-pro)
        --> Pass 2 (Verify & refine translation, return confidence)
        --> Response with { original, english, detectedLang, confidence, refined }
```

Pass 2 system prompt:
- "You are a translation quality reviewer. Given the original text and its translation, check for accuracy, grammar, cultural appropriateness, and domain terminology. Return the refined translation and a confidence score 0-100."

### Frontend Mic Flow (Fixed)

```text
User clicks Start
  --> SpeechRecognition starts
  --> All text accumulated in accumulatedTextRef
  --> Interim text shown live
User clicks Stop
  --> Read accumulatedTextRef.current (full text)
  --> Single API call with full context
  --> Show result with confidence badge
```

### Files Modified

1. **`supabase/functions/transcribe-translate/index.ts`**
   - Switch model to `google/gemini-2.5-pro`
   - Add two-pass verification pipeline
   - Enhanced system prompts
   - Add `targetLang` parameter support
   - Return `confidence` score

2. **`src/components/office/TranscribeView.tsx`**
   - Fix mic stop with ref-based accumulation (no setTimeout hack)
   - Add confidence badge display
   - Add target language selector in Advanced Options
   - Add recording timer and word counter
   - Auto-translate full text on stop (single pass, not chunks)
   - Add "Re-translate" button for low-confidence results
