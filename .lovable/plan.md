

# Aggressive Noise Suppression for AZIN Translator

## Problem
1. The translator still processes and displays unclear/noisy audio (e.g., "God, God.", "It's unbelievable." from background noise)
2. When no clear speech is detected, it should stay completely silent — no output at all
3. The error fallback shows raw transcription text instead of silently discarding

## Changes

### 1. Client-side: Stronger filters + silent error handling (`useRealtimeTranscribe.ts`)

- **Increase minimum thresholds**: Require 4+ words and 15+ characters (up from 3/10)
- **Add repetition filter**: Detect repeated short phrases like "God, God" (same word repeated)
- **Silent error fallback**: On translation failure, remove the entry entirely instead of showing raw text
- **Add post-translation length check**: If the translated text is very short (< 3 words), discard it

### 2. Server-side: Much stricter prompt (`translate-message/index.ts`)

- **Zero tolerance noise gate**: Add explicit instruction that the translator must NEVER generate its own speech or respond to the user
- **Stricter examples**: Add examples of what should return empty — "God God", short exclamations, fragments without clear sentence structure
- **Lower temperature to 0.01** for maximum determinism
- **Add rule**: If the input is fewer than 5 words in any language, return empty unless it forms a complete, coherent sentence

### 3. Post-parse validation (server-side)

After parsing the AI response, validate that translations are not just filler phrases. If any translation value is fewer than 3 words, replace it with empty string before returning.

## Summary
- Raise all thresholds significantly — prefer silence over noise
- Silent discard on errors (never show raw transcription)
- Server validates output length after AI responds
- Temperature near zero for deterministic behavior

