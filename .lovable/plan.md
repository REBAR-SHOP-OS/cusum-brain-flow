

# Investigation: Pixel "Edge Function returned a non-2xx status code"

## Findings

The `ai-agent` edge function is **deployed and syntactically valid** — it returns 401 when called without auth, confirming the bundle is fine.

The error at 08:27 AM is a **runtime failure** (500), not a deploy issue. Key evidence:

1. **Zero logs captured** for `ai-agent` in the edge function dashboard — this means the crash happened either during boot (import resolution) or the function hit a **wall-clock timeout** before any `console.log` could flush.

2. **"Generate all 5 slots now"** is the heaviest operation in the entire system: for each of 5 slots, it runs:
   - 1 AI call to generate dynamic caption/slogan/hashtags (`generateDynamicContent`)
   - 1 AI image generation call via Lovable AI gateway
   - 1 image upload to storage
   - Optional crop/resize
   
   That's **10+ AI API calls** sequentially — easily exceeding the edge function's **default 60s wall-clock limit**.

## Most Likely Cause

**Edge function timeout.** Supabase edge functions have a ~60s execution limit. Generating all 5 slots sequentially takes 2-3 minutes of AI calls. The function dies mid-execution with a generic 500, and no logs are flushed.

## Proposed Fix

### Option A: Parallelize slot generation (recommended)
Change the `for (const slot of slotsToGenerate)` loop to use `Promise.all` or `Promise.allSettled` so all 5 slots generate concurrently. This cuts wall time from ~150s to ~30s.

### Option B: Break into per-slot calls from frontend
Instead of sending "all" as a single request, have the frontend fire 5 parallel requests — one per slot. This keeps each request under the timeout limit.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/ai-agent/index.ts` | Parallelize the `slotsToGenerate` loop using `Promise.allSettled` instead of sequential `for` loop |

