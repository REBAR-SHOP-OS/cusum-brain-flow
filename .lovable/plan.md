

# Fix: Hide Raw/Farsi Text from Main Transcript — Show Only English

## Problem
The circled line in the screenshot shows raw Farsi text (`می‌تونه خیلی تاثیر بذاره در روند`) appearing in the main transcript panel. This happens because:

1. **`LiveTranscript.tsx` line 46**: `{t.translatedText || t.text}` — falls back to raw `t.text` (garbled/Farsi) when translation isn't ready yet or fails
2. **`WatchMode.tsx` line 90**: `{t.text}` — always shows raw Scribe output, never English

## Changes

### 1. `src/components/transcribe/LiveTranscript.tsx` (line 44-50)
Replace the display logic so it never shows raw `t.text`:
- If `isTranslating` → show "translating…" placeholder
- If `translatedText` exists → show it
- Otherwise → show nothing (empty string)

```tsx
{t.isTranslating ? (
  <span className="text-xs text-muted-foreground italic animate-pulse">translating…</span>
) : (
  t.translatedText || ""
)}
```

Remove the old `{t.translatedText || t.text}` and `{t.isTranslating && ...}` block entirely.

### 2. `src/components/transcribe/LiveTranscript.tsx` (lines 54-63)
Hide raw partial text — replace with a "Listening…" indicator:
```tsx
{partial && (
  <div className="flex gap-2 items-start">
    <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 min-w-[3rem]">…</span>
    <span className="text-sm text-muted-foreground italic animate-pulse">Listening…</span>
  </div>
)}
```

### 3. `src/components/transcribe/WatchMode.tsx` (line 90)
Change `{t.text}` to `{t.translatedText || t.text}` so English translation is preferred when available. Also hide partial raw text (lines 92-96) with a "Listening…" indicator.

### 4. `src/components/office/TranscribeView.tsx` (line 894)
The right-side panel fallback `{displayText || t.translatedText || t.text}` also shows raw text — change to `{displayText || t.translatedText || ""}` and add a translating indicator when neither is available.

These four changes ensure raw Scribe output (Farsi phonetics or garbled text) never appears in any transcript view — only clean English translations are shown.

