

## Plan: Connect Vizzy Voice to Full Brain Context

### Problem
The voice flow builds a rich system prompt (ERP data, brain memories, time context) client-side but never sends it to the backend. The edge function only forwards the last user message as `{ text }` to Vizzy One API. Result: zero business context reaches the AI.

### Changes

**1. `src/hooks/useVizzyStreamVoice.ts`**

- **`callPersonaPlex()` (line 123)**: Add `systemPrompt: getSystemPrompt()` to the request body sent to the edge function. The `messages` array is already sent.
- **`updateSessionInstructions()` (line 341)**: Store the new instructions in a ref (`latestInstructionsRef`) so the next `callPersonaPlex` call uses fresh context instead of being a no-op.
- **`sendFollowUp()` (line 345)**: Add the text to conversation history as a hidden entry (role: `"system"`) instead of `"user"`, so `[TOOL_RESULTS_READY]` messages don't appear as user chat bubbles. Skip adding user transcript for system-prefixed messages.

**2. `supabase/functions/personaplex-voice/index.ts`**

- Extract `systemPrompt` and `messages` from the request body.
- Attempt to forward `{ text, systemPrompt, messages, source }` to Vizzy One API.
- **Fallback**: If the Vizzy One API doesn't accept those fields (or returns an error), prepend context into the `text` field using the format:

```
SYSTEM:\n${systemPrompt}\n\nCONVERSATION:\n${messages}\n\nUSER:\n${text}
```

- Audio reply handling stays unchanged.

### Detailed File Changes

| File | Line(s) | Change |
|---|---|---|
| `src/hooks/useVizzyStreamVoice.ts` | 46 | Add `latestInstructionsRef` to store current system prompt |
| `src/hooks/useVizzyStreamVoice.ts` | 92-128 | In `callPersonaPlex`: add `systemPrompt` to fetch body |
| `src/hooks/useVizzyStreamVoice.ts` | 341-343 | `updateSessionInstructions`: write to `latestInstructionsRef` instead of no-op |
| `src/hooks/useVizzyStreamVoice.ts` | 345-348 | `sendFollowUp`: use role `"system"` for hidden messages, skip user transcript |
| `supabase/functions/personaplex-voice/index.ts` | 23-28 | Extract `systemPrompt`, `messages` from body |
| `supabase/functions/personaplex-voice/index.ts` | 47-55 | Build enriched payload with context fallback |

### What Does NOT Change
- Audio playback (base64 + browser TTS fallback)
- UI layout, styling, animations
- STT (browser SpeechRecognition)
- Session start/end lifecycle
- Edge function auth mode and CORS

### Result
Every voice request now carries the full system prompt (with ERP data, brain memories, time clock) and conversation history to the Vizzy One API. `updateSessionInstructions` actively stores fresh context. Hidden follow-up messages stay hidden from the user transcript.

