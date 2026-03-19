

# Fix: Precise Translation with Noise Silence

## What's Still Wrong
1. The AI sometimes generates its own response instead of just translating (e.g., answering a question it hears)
2. The 3-word minimum filter is too aggressive — it blocks valid short Farsi translations (Farsi words can be longer/compound)
3. The "fewer than 5 words = empty" noise gate rule is counterproductive — it blocks legitimate short sentences like "Is everything okay?"

## Changes

### 1. Refine `translate-message/index.ts` prompt
- Remove the "fewer than 5 words" rule — it blocks valid speech
- Add a stronger anti-response rule: "If the input is a question, translate the question. Do NOT answer it."
- Add explicit examples of correct translation vs. wrong response behavior
- Keep temperature at 0.01

### 2. Fix post-parse validation in `translate-message/index.ts`
- Lower the word-count threshold from 3 to 2 for Farsi (`fa`) since Farsi compound words count as single tokens
- Keep the 3-word minimum only for English translations

### 3. Tune client-side filters in `useRealtimeTranscribe.ts`
- Lower threshold from 4 words / 15 chars back to **3 words / 10 chars** for better balance of speed vs. noise
- Keep the repetition filter and letter-ratio filter (these work well)
- Lower post-translation discard threshold from 3 words to 2 words

### 4. Strengthen voice interpreter noise filter in `useVoiceEngine.ts`
- The AZIN avatar voice interpreter (OpenAI Realtime) also has the "responding" problem
- Increase the user transcript filter from `< 3 words && < 15 chars` to match the same logic as the text translator

## Files to Edit
- `supabase/functions/translate-message/index.ts` — prompt + validation
- `src/hooks/useRealtimeTranscribe.ts` — client filters
- `src/hooks/useAzinVoiceInterpreter.ts` — strengthen instructions

