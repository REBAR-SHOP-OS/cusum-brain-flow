

# Fix Translation Quality: Filter Noise, Ensure Both Buttons Work

## Problem
1. Translation picks up unclear/noisy audio and translates gibberish
2. Both EN and FA buttons need to properly translate in their respective directions

## Root Causes
- Client-side filter is too weak: only filters `<2 words` or `<5 chars` — lets through noise fragments
- The `translate-message` prompt asks AI to return empty for noise, but short noisy fragments still slip through
- When switching languages mid-session, there's a 100ms delay that may cause race conditions

## Changes

### 1. Strengthen client-side noise filtering (`useRealtimeTranscribe.ts`)
- Increase minimum threshold: require **3+ words** and **10+ characters** for committed transcripts
- Add a confidence check: filter out text that's mostly symbols, repeated characters, or non-alphabetic content
- Add a regex filter to catch common noise patterns (repeated syllables, single-character words)

### 2. Improve server-side prompt (`translate-message/index.ts`)
- Strengthen the noise detection instructions — be more aggressive about returning empty for:
  - Fragments shorter than 3 meaningful words
  - Repeated syllables or filler sounds ("ah ah ah", "um um")
  - Text that doesn't form a coherent phrase
- Add explicit instruction: "If you are not confident this is clear, intentional speech, return empty strings"

### 3. Fix language toggle reliability (`AzinInterpreter.tsx`)
- Remove the 100ms `setTimeout` when switching languages — instead await disconnect, then connect immediately
- Ensure `sourceLangRef` is updated before `connect()` is called so the correct language is passed to translation

## Technical Details

**Client filter (useRealtimeTranscribe.ts lines 36-40):**
```
Current:  wordCount < 2 || trimmed.length < 5
Proposed: wordCount < 3 || trimmed.length < 10 || isNoisePattern(trimmed)
```

New `isNoisePattern()` helper checks for:
- Mostly non-letter characters (>50% symbols/digits)
- Repeated single syllables ("da da da")
- All-caps short fragments that are typically noise artifacts

**Server prompt addition:**
Add stronger gate: "Err on the side of returning empty strings. Only translate text that clearly represents intentional, coherent speech from a person. Short filler sounds, background murmur, or fragments without clear meaning should all return empty strings."

**Language switch fix:**
```typescript
// Before: disconnect → setTimeout 100ms → connect (race condition)
// After:  disconnect → setSourceLang → connect (synchronous flow)
```

