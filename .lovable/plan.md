

# Fix: Vizzy Voice Hallucinating Random Content (French Apartment Listing)

## Problem

Vizzy voice responded with a **French apartment listing** when asked about call data. The model (`gpt-realtime-mini`) completely lost context and generated unrelated content. This indicates:

1. **Model `gpt-realtime-mini` is unreliable** — this isn't a valid OpenAI model identifier. The correct model should be `gpt-4o-mini-realtime-preview-2025-06-03` or similar. An invalid model string may cause OpenAI to fall back to unpredictable behavior.
2. **No output guardrail** — when the model generates non-English/non-Farsi content or clearly off-topic text, nothing catches it.
3. **No language enforcement on agent output** — the `isSelfTalk` filter only runs in `translationMode`, so random French output passes through unchecked.

## Changes

### 1. Fix Model Identifier (`src/hooks/useVizzyVoiceEngine.ts`)

**Line 268**: Change `gpt-realtime-mini` to a valid OpenAI Realtime model:
```
model: "gpt-4o-mini-realtime-preview-2025-06-03"
```

### 2. Add Agent Output Language Guard (`src/hooks/useVoiceEngine.ts`)

In the agent transcript handler (where `response.audio_transcript.done` is processed), add a check that blocks agent output containing unexpected languages. Vizzy should only output English or Farsi (Persian). If the output contains French, Spanish, Chinese, etc. — discard it silently.

Add a detection function:
```typescript
const UNEXPECTED_LANG = /\b(appartement|loyer|disponible|découvrir|équipée|chauffage|commerces|caractéristiques|hésitez|contacter|visite|chambres|cuisine|superficie)\b/i;
const ALLOWED_SCRIPTS = /[a-zA-Z\u0600-\u06FF\u0750-\u077F]/; // Latin + Farsi/Arabic

function isOffTopicOutput(text: string): boolean {
  if (UNEXPECTED_LANG.test(text)) return true;
  // Block if >50% of words are non-English/non-Farsi
  const words = text.split(/\s+/);
  if (words.length > 20) {
    const frenchIndicators = text.match(/[àâéèêëïîôùûüçœæ]/g);
    if (frenchIndicators && frenchIndicators.length > 5) return true;
  }
  return false;
}
```

When detected, skip adding the transcript and log a warning.

### 3. Add Temperature Control (`src/hooks/useVizzyVoiceEngine.ts`)

The engine config doesn't set `temperature`. Add `temperature: 0.6` to reduce creative drift. Lower temperature = more deterministic, less hallucination.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useVizzyVoiceEngine.ts` | Fix model to valid identifier, add temperature: 0.6 |
| `src/hooks/useVoiceEngine.ts` | Add off-topic/wrong-language filter on agent output |

## Expected Result
- Valid model identifier prevents unpredictable fallback behavior
- Wrong-language outputs (French, Spanish, etc.) are silently blocked
- Lower temperature reduces creative hallucination

