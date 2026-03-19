

# Upgrade Nila Interpreter: Better Model + Silence Handling

## Problem
1. Translation model (`gemini-2.5-flash`) can miss nuances in both Farsi and English
2. When user is silent, the system still shows "Listening..." and may pick up noise — it should stay completely quiet

## Changes

### 1. Upgrade translation model to `gemini-2.5-pro`
**File:** `supabase/functions/translate-message/index.ts`
- Change `model: "gemini-2.5-flash"` → `model: "gemini-2.5-pro"` for higher accuracy in both Farsi and English translation
- Enhance the system prompt to emphasize natural fluency in both languages and proper Farsi colloquial expressions

### 2. Strengthen silence/noise filtering
**File:** `src/hooks/useAzinVoiceRelay.ts`
- Increase minimum word count from 1 to 2 words for the noise blocklist filter (single filler words like "yeah", "hmm" already blocked, but extend to 2-word fillers)
- Add minimum character threshold: reject committed transcripts shorter than 8 characters (matching the memory standard of "< 3 words/8 chars")
- Add minimum word count of 3 for very short fragments that are likely noise

### 3. Improve translation prompt for natural pronunciation
**File:** `supabase/functions/translate-message/index.ts`
- Update prompt to instruct: "For Farsi, use natural conversational Persian (محاوره‌ای) — not formal/literary. For English, use natural spoken English."
- Add rule: "If the input is silence, noise, filler words, or meaningless fragments, return empty strings for all target languages."

## Summary
- `gemini-2.5-pro` = more accurate hearing + better bilingual fluency
- Stricter client-side noise gates = silence when user is silent
- Prompt update = natural-sounding translations in both languages

