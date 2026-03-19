

# Fix AZIN Voice Interpreter — Pure Translation Only

## Problem

The AZIN voice interpreter is using `gpt-4o-mini-realtime-preview`, a weaker model that produces poor translations (as seen in screenshot: "I only have the ability" — incomplete/inaccurate). The prompt is already well-structured but the model lacks translation capability.

## Changes

### 1. Upgrade model for better translation quality
**File: `src/hooks/useAzinVoiceInterpreter.ts`**

- Change model from `gpt-4o-mini-realtime-preview` → `gpt-4o-realtime-preview` (full model, much better at Farsi↔English translation)

### 2. Sharpen the prompt for translation accuracy
**File: `src/hooks/useAzinVoiceInterpreter.ts`**

Simplify and strengthen the system prompt to focus purely on translation quality:
- Remove redundant negative rules (11 rules → 5 focused rules)
- Add explicit instruction for idiomatic, natural-sounding translations
- Emphasize complete sentences (not partial fragments)
- Add instruction to preserve tone and intent

### 3. Tune VAD settings for complete utterances
**File: `src/hooks/useAzinVoiceInterpreter.ts`**

- Increase `silenceDurationMs` from 300 → 600ms to capture complete sentences before translating (prevents cutting off mid-sentence, which causes incomplete translations like "I only have the ability")
- Increase `prefixPaddingMs` from 200 → 300ms for better speech start detection

## Technical Details

The OpenAI Realtime API supports both `gpt-4o-realtime-preview` and `gpt-4o-mini-realtime-preview`. The mini variant is cheaper but significantly worse at translation tasks, especially for Farsi. The full model handles bidirectional Farsi↔English translation with much higher accuracy.

The VAD (Voice Activity Detection) timing change ensures the model receives complete utterances before attempting translation, preventing fragment-based mistranslations.

