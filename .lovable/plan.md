

## Fix: Translations Show "—" Because AI Responses Are Truncated

### Root Cause (confirmed from edge function logs)

**Every single translation is being truncated by the AI model.** Logs show:

```
Failed to parse translation: {"en": "and get to the root of the
Failed to parse translation: {"en": "Instead of writing, they
Failed to parse translation: {"en": "It's a really bad feeling.
Failed to parse translation: {"en": "Oh, it drew a black line
```

The AI returns JSON cut off mid-value — no closing `"` or `}`. Two compounding issues:

1. **`maxTokens: 300` is too low** — The model runs out of output tokens before finishing the JSON. For bilingual output (English + Farsi), 300 tokens is insufficient because Farsi script uses more tokens per word.

2. **Regex fallback fails on truncated values** — The regex `/"(\w{2})"\s*:\s*"((?:[^"\\]|\\.)*)"/g` requires a closing `"` after the value. When the response is `{"en": "some text that gets cut`, there's no closing quote → regex matches nothing → `translations = {}` → hook gets empty → UI shows "—".

### Fix — Two Changes

**File: `supabase/functions/translate-message/index.ts`**

1. **Increase `maxTokens` from 300 to 800** — gives the model enough room to complete both English and Farsi translations without truncation.

2. **Fix the regex to recover truncated values** — add a second pass that captures values even without a closing quote. When the JSON ends mid-value like `{"en": "some text here`, extract `"some text here"` as the value for `en`:

```typescript
// After the existing regex pass, handle truncated trailing value
if (Object.keys(result).length === 0) {
  // Try capturing value without closing quote (truncated at end)
  const truncatedRegex = /"(\w{2})"\s*:\s*"((?:[^"\\]|\\.)*?)$/;
  const truncMatch = truncatedRegex.exec(cleaned);
  if (truncMatch) {
    result[truncMatch[1]] = truncMatch[2].trim();
  }
}
```

**File: `src/hooks/useRealtimeTranscribe.ts`**

3. **Show raw text as fallback in BOTH columns when translation fails** — Currently, if `sourceLang === "fa"` and translation fails, `englishText` stays `undefined` → "—". Instead, when translation completely fails, populate both fields with raw text so the user at least sees something. The "—" should only appear for genuinely empty/noise segments.

```typescript
// On failure or empty translation: show raw text as fallback in both fields
// rather than leaving one field empty showing "—"
englishText: translatedEn || (currentSourceLang === "en" ? data.text.trim() : undefined),
farsiText: translatedFa || (currentSourceLang === "fa" ? data.text.trim() : undefined),
```

### Why This Fixes It

- **Primary fix**: Increasing `maxTokens` to 800 prevents truncation entirely — the model will complete its JSON output
- **Safety net**: The improved regex recovers partial translations from any remaining truncated responses
- **UI resilience**: Raw text fallback ensures users never see just "—" for valid speech

### Files
- `supabase/functions/translate-message/index.ts` — increase maxTokens to 800, fix truncated JSON regex
- `src/hooks/useRealtimeTranscribe.ts` — better fallback when translation returns empty

