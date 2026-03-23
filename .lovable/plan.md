

## Fix: English Column Showing Farsi Text

### Root Cause

Two compounding issues:

1. **Truncated AI responses** — Edge function logs show the AI model returning incomplete JSON (e.g., `{"en": "some text\n` without closing `"}`) causing `JSON.parse` to fail. When parsing fails, `translations = {}`, all fields are empty, and the hook's fallback logic fires.

2. **Wrong fallback in hook** — When translation fails or returns empty, the hook sets `englishText = data.text.trim()` regardless of source language. If the user spoke Farsi, `data.text` IS Farsi — so the English column displays Farsi text.

### Changes

**File: `supabase/functions/translate-message/index.ts`**

1. **Robust JSON extraction** — Replace the simple `JSON.parse` with a regex-based extractor that can recover partial values from truncated JSON. For example, extract `"en": "some text"` even if the closing brace is missing. This will dramatically reduce fallback cases.

2. **Add `response_mime_type: "application/json"`** — Tell Gemini to output structured JSON, reducing truncation.

**File: `src/hooks/useRealtimeTranscribe.ts`**

3. **Language-aware fallback** — When translation fails or is empty, ONLY populate the field matching the source language with raw text. Never put Farsi text in `englishText`:
   - If `sourceLang === "fa"`: set `farsiText = raw text`, leave `englishText = undefined`
   - If `sourceLang === "en"`: set `englishText = raw text`, leave `farsiText = undefined`
   - If `sourceLang === "auto"`: set raw text only to the detected language field

**File: `src/components/transcribe/LiveTranscript.tsx`**

4. **Skip entries with no English text** — If `englishText` is undefined/empty and `isTranslating` is false, show a subtle "—" or skip rather than falling back to `translatedText` (which may also be Farsi).

### Files
- `supabase/functions/translate-message/index.ts` — robust partial JSON extraction
- `src/hooks/useRealtimeTranscribe.ts` — language-aware fallback (never put wrong language in wrong field)
- `src/components/transcribe/LiveTranscript.tsx` — don't fall back to non-English text

