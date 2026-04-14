

## Plan: Strengthen Noise Filtering in Nila Interpreter

### Problem
Nila currently translates low-confidence or garbled audio — random sounds, filler words, and misheard fragments get through and produce bad translations.

### Current State
Both `useRealtimeTranscribe.ts` and `useNilaVoiceRelay.ts` have basic filters (min word count, letter ratio, noise blocklist, repeated chars). But they're too lenient — short unclear phrases and common STT hallucinations still pass through.

### Changes

**1. `src/hooks/useNilaVoiceRelay.ts`** (voice chat mode)
- Expand `NOISE_BLOCKLIST` with more filler/hallucination words (e.g., "thank you", "thanks", "you know", common STT artifacts like "you", "the", "I", "a" as standalone)
- Raise minimum threshold: require at least **3 words AND 10 characters** (currently 3 words OR 8 chars)
- Add duplicate-word detector: reject if >60% of words are the same word repeated
- Add STT hallucination patterns: reject strings that are just repeated short phrases (e.g., "thank you thank you thank you")
- Filter transcripts where unique words < 40% of total words (repetitive gibberish)

**2. `src/hooks/useRealtimeTranscribe.ts`** (split-column mode)
- Apply the same stricter filters: raise from 2 words/5 chars to **3 words/10 chars**
- Add the same expanded noise blocklist and repetition detector
- Add duplicate-word filter matching the voice relay hook

### Specific Filter Additions
```text
Expanded noise blocklist (single/double word catches):
  thank you, thanks, you know, I mean, let me, 
  what, the, a, an, it, is, this, that, and, but,
  come on, go ahead

New repetition detector:
  - Split into words, count frequency of most common word
  - If mostCommonWord appears in >60% of words → reject

Raised thresholds:
  - wordCount < 3 → reject (was 2 in transcribe, 3 in relay but with OR)
  - trimmed.length < 10 → reject (was 5/8)
```

### Files
| File | Change |
|---|---|
| `src/hooks/useNilaVoiceRelay.ts` | Stricter thresholds, expanded blocklist, repetition filter |
| `src/hooks/useRealtimeTranscribe.ts` | Same stricter thresholds and filters |

### Result
- Only clear, meaningful speech gets translated
- Filler words, repeated sounds, and STT hallucinations are silently dropped
- Both interpreter modes (split-column and voice chat) share the same quality bar

