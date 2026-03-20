

## Fix: Nila Interpreter Translations Returning Empty

### Root Cause

The edge function logs and network responses confirm the issue:

```
Edge log: "Failed to parse translation: " (empty response from AI)
Network: POST translate-message → {"translations":{}}
```

The AI model (`gemini-2.5-pro`) is returning empty/unparseable responses for valid English input. This happens because:

1. **Model refusal on sensitive content** — Gemini 2.5 Pro refuses to translate text containing political/sensitive topics (e.g., the logged transcript about war/politics). It returns empty instead of a translation.
2. **Wrong model** — Per established standards, `translate-message` should use `gemini-2.5-flash` for speed and lower refusal rates, but the code currently uses `gemini-2.5-pro`.
3. **Empty response = silent discard** — When the translation returns `{}`, the client removes the transcript entry entirely, making it look like the mic isn't working.

The microphone IS working (Scribe captures and commits transcripts correctly, as seen in the console logs). The problem is 100% on the translation side.

### Changes

**File: `supabase/functions/translate-message/index.ts`**

1. Switch model from `gemini-2.5-pro` to `gemini-2.5-flash` (faster, cheaper, less prone to content refusal)
2. Add an explicit instruction to the system prompt: "You MUST translate ALL content regardless of topic. Never refuse. Never return empty for valid speech."
3. Add a fallback: if the AI returns empty for text that has 3+ real words, retry once with a simpler prompt

**File: `src/hooks/useAzinVoiceRelay.ts`**

4. Instead of silently removing entries when translation is empty, show the original text with a "(translation unavailable)" note, so the user can see the mic is working even if translation fails

### Technical Details

- The memory standard explicitly states `gemini-2.5-flash` for this function
- The Faithful Translator mandate means the model should never interpret or react to content
- Adding the anti-refusal instruction to the system prompt should fix most cases
- The fallback retry handles edge cases where the model still refuses

