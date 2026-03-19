

# Fix: Nila Interpreter Picking Up Wrong Languages (Bengali etc.)

## Problem
Scribe connects without a language hint and sometimes transcribes speech as Bengali, Hindi, or other scripts instead of English/Farsi. The screenshot shows Bengali text "ইয়াত আছে আরু..." displayed as partial transcript. The committed transcript filter already blocks non-Farsi/Latin text, but the **partial text** has no such filter, and the committed filter could be stronger.

## Root Cause
1. **Partial text** (`onPartialTranscript`) has no script validation — anything Scribe hears gets displayed raw
2. **Committed text** filter checks `HAS_FARSI_OR_LATIN` but this regex also passes if there's *any* Latin/Farsi character mixed with other scripts
3. No language hint passed to Scribe, so it auto-detects and sometimes picks wrong languages

## Changes

### File: `src/hooks/useAzinVoiceRelay.ts`

1. **Add a strict script filter** — new regex that rejects text containing non-Latin/non-Farsi Unicode blocks (Bengali, Devanagari, CJK, Tamil, etc.):
   ```
   FOREIGN_SCRIPT = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0D7F\u0E00-\u0E7F\u1000-\u109F\u3000-\u9FFF\uAC00-\uD7AF]/
   ```
   Any text matching this is silently dropped.

2. **Filter partial text** — in `onPartialTranscript`, apply the same script filter before calling `setPartialText`. If the text contains foreign scripts, ignore it.

3. **Strengthen committed filter** — in `onCommittedTranscript`, add the foreign script check alongside the existing `HAS_FARSI_OR_LATIN` check. Text must contain Farsi or Latin AND must NOT contain foreign scripts.

### Result
Bengali, Hindi, and other non-English/Farsi transcriptions will be silently dropped at both partial and committed stages. Only English and Farsi text will be displayed and translated.

