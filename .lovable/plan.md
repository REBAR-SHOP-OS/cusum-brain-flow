

## Fix: Slow & Inaccurate Translation in Realtime Transcribe

### Root Cause

**Wrong model**: `translate-message` edge function uses `gemini-2.5-pro` (line 96) — the slowest, most expensive model. Per project standards, it should use `gemini-2.5-flash` which is 3-5x faster with comparable translation quality.

Additionally, the retry logic (lines 128-138) doubles latency when translations return empty, and the `invokeEdgeFunction` wrapper adds overhead with session checks on every call.

### Changes

**File: `supabase/functions/translate-message/index.ts`**

1. **Switch model from `gemini-2.5-pro` to `gemini-2.5-flash`** — dramatically reduces latency while maintaining translation accuracy
2. **Simplify retry logic** — remove the second full AI call on empty results; instead, return the raw text as fallback to avoid doubling response time
3. **Streamline the prompt** — reduce token count in system prompt for faster processing

**File: `src/hooks/useRealtimeTranscribe.ts`**

4. **Reduce timeout** — the `invokeEdgeFunction` default 30s timeout is too generous; set to 10s for translation calls so failures surface faster
5. **On translation failure, show raw text instead of discarding** — currently errors silently remove entries (line 108), leaving users with "translating..." forever. Show the original text with a marker instead.

### Summary
- Primary fix: `gemini-2.5-pro` → `gemini-2.5-flash` (3-5x speed improvement)
- Secondary: remove expensive retry, reduce timeout, show fallback text on failure

### Files
- `supabase/functions/translate-message/index.ts` — faster model + simplified retry
- `src/hooks/useRealtimeTranscribe.ts` — shorter timeout + graceful fallback

