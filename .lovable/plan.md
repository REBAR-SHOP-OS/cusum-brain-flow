

# Fix: Live Transcript Shows Only English

## Problem
The live transcript area (main panel) sometimes shows raw Scribe output (garbled phonetic text or Farsi fragments) instead of clean English. This happens in two cases:
1. While waiting for translation (`isTranslating: true`), the raw `text` is displayed as fallback
2. The partial (live typing) text shows raw Scribe output before any translation

## Fix

### `src/components/transcribe/LiveTranscript.tsx`
- **Committed entries**: When `isTranslating` is true, show only "translating…" placeholder — do NOT show raw `t.text`. When translation is done, show only `t.translatedText`.
- **Partial text**: Hide the partial raw Scribe text entirely since it's untranslated and often garbled for non-English. Instead show a simple "Listening…" indicator while speech is detected.

### Changes (line 44-51):
```tsx
// Before: shows raw text as fallback
{t.translatedText || t.text}

// After: show only English translation, placeholder while translating
{t.isTranslating ? (
  <span className="text-xs text-muted-foreground italic animate-pulse">translating…</span>
) : (
  t.translatedText || ""
)}
```

### Partial text section (lines 54-63):
Replace showing raw `partial` text with a subtle "Listening…" indicator when partial text exists (meaning speech is being detected but not yet committed).

