

## Fix: Separate English-Only and Farsi-Only Display in Transcribe View

### Problem

The English column (LiveTranscript) and Farsi sidebar both show mixed-language content. When someone speaks English, the English column shows the Farsi translation (wrong). When someone speaks Farsi, the sidebar sometimes shows English text. Each column must show ONLY its respective language.

### Root Cause

The hook stores a single `translatedText` field that varies by source language — when source is English, `translatedText` = Farsi; when source is Farsi, `translatedText` = English. The LiveTranscript component blindly displays `translatedText` regardless of what language it contains. The sidebar has similar confusion.

### Fix

**File: `src/hooks/useRealtimeTranscribe.ts`**

1. Add `englishText` and `farsiText` fields to `CommittedTranscript` interface
2. In the translation response handler, populate both fields explicitly:
   - If source=en: `englishText = original text`, `farsiText = translatedFa`
   - If source=fa: `englishText = translatedEn`, `farsiText = original text (cleaned)`
   - If source=auto: `englishText = translatedEn || text`, `farsiText = translatedFa || text`
3. Keep `translatedText` for backward compatibility with other consumers

**File: `src/components/transcribe/LiveTranscript.tsx`**

4. The English column — change display from `t.translatedText` to `t.englishText` (the English-only field)
5. Show `[Raw]` prefix only when `englishText` is missing and falling back to raw text

**File: `src/components/office/TranscribeView.tsx`**

6. The Farsi sidebar (lines 1133-1151) — change display to always use `t.farsiText` instead of the current complex fallback chain
7. Remove the `originalCleanText` / `translationMap` indirection for the sidebar — use `farsiText` directly from the hook

### Speed Improvement

8. In `useRealtimeTranscribe.ts`, reduce the context window from 3 segments to 1 segment — less prompt tokens = faster response
9. Remove the post-translation word-count filter (`translationWordCount < 2` check) which silently discards valid short translations

### Files
- `src/hooks/useRealtimeTranscribe.ts` — add `englishText`/`farsiText` fields, reduce context
- `src/components/transcribe/LiveTranscript.tsx` — display `englishText` only
- `src/components/office/TranscribeView.tsx` — sidebar displays `farsiText` only

