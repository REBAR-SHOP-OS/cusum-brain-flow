

# Fix: Faithful Transcription - Write Exactly What Is Heard

## Problem
The current `translate-message` system prompt instructs the AI to "reconstruct the intended meaning" and "resolve ambiguous phonetic approximations." This causes the AI to change, guess, or fabricate content instead of faithfully transcribing what was actually spoken.

## Change

### `supabase/functions/translate-message/index.ts` — Rewrite system prompt

Replace the current "post-processor/reconstructor" prompt with a "faithful translator" prompt:

- Remove instructions to "reconstruct intended meaning" and "resolve ambiguous phonetic approximations"
- Add: "Translate the text EXACTLY as given. Do NOT change, rephrase, or guess at what was 'actually meant.' The speech recognition system has already transcribed accurately — your only job is to translate faithfully."
- Keep the noise/gibberish filter (empty strings for pure noise)
- Keep the context window but only for terminology consistency, NOT for changing what was said
- Change the context instruction from "Resolve ambiguous phonetic approximations by inferring from conversation flow" to "Use for consistent terminology only — never alter the source meaning"

This single prompt change ensures the displayed transcript matches exactly what the speaker said.

