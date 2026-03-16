

# Filter Unintelligible Segments from Transcription

## Problem
When the speech recognition produces garbled/unintelligible text (shown in the screenshot as `◆ⓑⒹⓂ`, `ⓌⒸⓇⒼ`, etc.), it pollutes the transcript display. The user wants these meaningless segments silently dropped.

## Solution — Two layers

### 1. Backend: `supabase/functions/translate-message/index.ts`
Add instruction to the system prompt telling Gemini to return **empty strings** when the input is unintelligible noise rather than attempting a translation:

```
- If the input is completely unintelligible gibberish, noise artifacts, or meaningless symbols with no recoverable speech, return empty strings for ALL language keys (e.g., {"en": "", "fa": ""}). Do NOT fabricate or guess content.
```

### 2. Frontend: `src/hooks/useRealtimeTranscribe.ts`
After receiving the translation response, check if the English translation is empty/whitespace-only. If so, **remove the entry** from `committedTranscripts` instead of displaying it:

```ts
// If AI determined it's unintelligible, remove the entry
if (!translatedEn || !translatedEn.trim()) {
  setCommittedTranscripts(prev => prev.filter(t => t.id !== entryId));
  return;
}
```

### Files to Edit
| File | Change |
|------|--------|
| `supabase/functions/translate-message/index.ts` | Add "return empty for unintelligible" instruction to system prompt |
| `src/hooks/useRealtimeTranscribe.ts` | Filter out entries where translation came back empty |

No database changes. No feature changes. Just smarter filtering of noise.

