

# Improve Transcription Accuracy — Comprehensive Fix

## Current Problems

1. **No language hint to Scribe** — The realtime Scribe model gets no `language_code`, so it guesses and often produces garbled English phonetics for Farsi speech
2. **Tiny context per translation** — Each committed segment (2-5 seconds) is translated independently, losing conversational context and producing inaccurate denoising
3. **Weak model for denoising** — Using `gemini-2.5-flash` for the critical speech reconstruction task; flash is fast but less accurate for phonetic reconstruction
4. **No autoGainControl** — Microphone missing `autoGainControl: true`, causing inconsistent audio levels
5. **No conversation history in translation** — Each segment is translated blind with no knowledge of prior segments

## Solution

### 1. `src/hooks/useRealtimeTranscribe.ts` — Context-aware translation with buffering

- **Add a rolling context buffer**: Keep last 5 translated segments and send them as context with each new translation request so Gemini can better reconstruct meaning from phonetic approximations
- **Add `autoGainControl: true`** to microphone settings for more consistent audio input
- **Pass conversation context** in the translation request body: `{ text, sourceLang, targetLangs, context: lastFiveTranslations }`

### 2. `supabase/functions/translate-message/index.ts` — Enhanced accuracy

- **Upgrade model** from `gemini-2.5-flash` to `gemini-2.5-pro` for the denoising/translation task — Pro is significantly better at phonetic reconstruction and semantic inference
- **Accept optional `context` parameter** — previous translated segments to maintain conversational coherence
- **Enhanced system prompt**: Add explicit instruction to use conversation context for disambiguation, and to prefer semantic coherence over literal phonetic matching
- **Lower temperature** from 0.15 to 0.05 for more deterministic output

### 3. `src/components/transcribe/LiveTranscript.tsx` — Show raw text on hover

- Add a tooltip on each committed transcript showing the raw Scribe output, so the user can verify what was heard vs. what was translated
- This helps debugging accuracy issues

### 4. `supabase/functions/elevenlabs-scribe-token/index.ts` — No changes needed

Token generation is fine as-is.

## Technical Details

**Context buffer approach:**
```typescript
// In useRealtimeTranscribe.ts
const contextRef = useRef<string[]>([]);

onCommittedTranscript: (data) => {
  // Send last 5 translations as context
  invokeEdgeFunction("translate-message", {
    text: data.text,
    sourceLang: "auto",
    targetLangs: ["en", "fa"],
    context: contextRef.current.slice(-5).join(" | "),
  });
  // After translation succeeds, push to context
  contextRef.current.push(translatedEn);
}
```

**Enhanced prompt addition:**
```
You also receive CONTEXT — the previous translated segments from the same conversation.
Use this context to:
- Maintain topic coherence
- Resolve ambiguous phonetic approximations
- Ensure consistent terminology
```

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useRealtimeTranscribe.ts` | Add context buffer, pass context to translate, add autoGainControl |
| `supabase/functions/translate-message/index.ts` | Upgrade to gemini-2.5-pro, accept context param, enhance prompt, lower temperature |
| `src/components/transcribe/LiveTranscript.tsx` | Add raw text tooltip for debugging |

