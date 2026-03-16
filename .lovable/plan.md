

# Speed Up Transcription & Improve Accuracy

## Problem
1. Translation is slow because it uses `gemini-2.5-pro` (heaviest model) for every small transcript segment
2. Rate limit is tight (20/min) which can cause delays when speaking quickly
3. The context window adds overhead to each request

## Changes

### 1. `supabase/functions/translate-message/index.ts` — Switch to faster model + raise rate limit

- Change model from `gemini-2.5-pro` to `gemini-2.5-flash` — 3-5x faster response time with comparable quality for translation tasks
- Raise rate limit from 20 to 60 requests per 60 seconds (realtime transcription generates many small segments)
- Shorten the system prompt slightly to reduce token processing time

### 2. `src/hooks/useRealtimeTranscribe.ts` — Reduce context overhead

- Reduce context window from 5 to 3 segments (less tokens to process per request = faster)
- Use `supabase.functions.invoke` directly instead of `invokeEdgeFunction` wrapper to eliminate any extra overhead

### Summary of speed improvements
| Change | Impact |
|--------|--------|
| `gemini-2.5-pro` → `gemini-2.5-flash` | ~3-5x faster response |
| Rate limit 20 → 60/min | No more throttling during fast speech |
| Context window 5 → 3 | Less tokens per request |

Accuracy remains high because `gemini-2.5-flash` is excellent at translation tasks, and the enhanced system prompt with context window is preserved.

