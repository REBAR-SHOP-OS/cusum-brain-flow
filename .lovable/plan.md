

# Fix: Nila Interpreter Language Detection

## Problem
The `detectRtl` function uses a simple "any RTL character present" check. ElevenLabs Scribe sometimes inserts invisible Unicode directional markers (U+200F, U+202B, etc.) into English transcriptions, causing English text to be misdetected as Farsi. Result: English speech gets "translated" back to English instead of to Farsi.

The screenshot shows "how are you?" rendered RTL (question mark at start) with a Translation of "how are you?" — English-to-English round-trip instead of English-to-Farsi.

## Fix

### 1. `src/utils/textDirection.ts` — Ratio-based detection
Replace the current "any RTL char present" logic with a character-ratio approach:
- Strip invisible directional markers (U+200F, U+202B, U+202E, U+2067) before testing
- Count actual RTL script characters (Arabic/Persian block) vs Latin characters
- Only classify as RTL if RTL characters outnumber Latin characters
- This makes detection immune to stray directional markers from Scribe

### 2. `src/hooks/useNilaVoiceRelay.ts` — Strip directional markers from transcriptions
Before running `detectRtl`, strip invisible Unicode directional characters from the committed transcript text. This prevents contamination at the source.

## Technical Detail

```typescript
// New detectRtl logic
export function detectRtl(text: string): boolean {
  if (!text) return false;
  // Strip invisible directional markers
  const clean = text.replace(/[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g, "");
  const rtlChars = (clean.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const ltrChars = (clean.match(/[a-zA-Z]/g) || []).length;
  if (rtlChars === 0 && ltrChars === 0) return false;
  return rtlChars > ltrChars;
}
```

## Files
| File | Action |
|------|--------|
| `src/utils/textDirection.ts` | Edit — ratio-based RTL detection, strip markers |
| `src/hooks/useNilaVoiceRelay.ts` | Edit — strip directional markers from Scribe output |

## Risk
- Minimal — only changes language detection logic
- No backend changes
- Existing Farsi detection still works (Farsi text will always have more RTL chars than Latin)

