

## Vizzy Live — Two Behavioral Bugs

### Bug 1: "I cannot hear you" → `[UNCLEAR]`
**Root cause**: The `VIZZY_LIVE_VOICE_INSTRUCTIONS` prompt tells the model to respond `[UNCLEAR]` for "truly garbled gibberish." The model is incorrectly classifying "I cannot hear you" as noise — likely because it's a meta-statement about the system rather than a business query, and the model over-triggers the `[UNCLEAR]` rule.

**Fix**: Add an explicit rule in the `UNCLEAR INPUT` section of `VIZZY_LIVE_VOICE_INSTRUCTIONS`:
- Sentences like "I cannot hear you", "I can't hear anything", "the audio isn't working", "you're not speaking" are **real user speech about audio issues** — NOT gibberish.
- For audio complaints, respond naturally: "I'm here — can you hear me now?" or "Let me try again."

### Bug 2: `[UNCLEAR]` displays as visible text in transcript
**Root cause**: When the model returns `[UNCLEAR]`, the code in `useVizzyStreamVoice.ts` strips it from the *speakable* text (line 153) but still adds the raw `[UNCLEAR]` to the transcript (line 138). The user sees `[UNCLEAR]` in the chat bubble, which is a bad UX.

**Fix**: In `useVizzyStreamVoice.ts`, when the agent response is exactly `[UNCLEAR]` (after trimming), skip adding it to the transcript entirely. No transcript bubble, no TTS — just silently ignore it so the conversation stays clean.

### Files changed
1. **`src/hooks/useVizzyVoiceEngine.ts`** — Update `VIZZY_LIVE_VOICE_INSTRUCTIONS` unclear input section to handle audio-complaint phrases.
2. **`src/hooks/useVizzyStreamVoice.ts`** — Skip transcript + TTS when response is exactly `[UNCLEAR]`.

### What stays unchanged
- Transport layer
- UI design
- ERP schema
- Anti-fabrication guardrails
- Greeting behavior
- `max_tokens` limit

