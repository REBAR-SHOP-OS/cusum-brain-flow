

# Fix: Video Not Publishing to Last Instagram Page (Rebar.shop Ontario)

## Root Cause

The Instagram video publishing loop in `social-publish/index.ts` is **sequential**. For each of the 5 selected pages, the function:

1. Creates a media container (~1-2s)
2. Polls for video processing status (up to 30 polls * 3s = **90 seconds**)
3. Publishes the container (~1-2s)

With 5 pages processed sequentially, worst case = **5 x 90s = 450 seconds**. The Supabase Edge Function times out (default ~60s, max ~150s) before reaching "Rebar.shop Ontario" — which is the **last page** in the list.

Evidence:
- Post `21b929c0` is stuck in `status=publishing` since 14:50 (over 12 min ago, stale lock not yet recovered)
- `page_name`: "Ontario Steel Detailing, Rebar.shop, Ontario Logistics, Ontario Steels, **Rebar.shop Ontario**" — last in list
- Token data confirms all 5 pages have valid, separate IG accounts (no dedup issue)

## Fix

### File: `supabase/functions/social-publish/index.ts`

**Parallelize Instagram video publishing** — instead of a sequential `for` loop, create all IG containers simultaneously and poll them in parallel using `Promise.allSettled`.

```text
BEFORE (sequential):
  Page 1: create → poll 90s → publish
  Page 2: create → poll 90s → publish
  ...
  Page 5: create → poll 90s → publish  ← TIMEOUT before reaching here
  Total: up to 450s

AFTER (parallel):
  All 5 pages: create containers simultaneously
  All 5 pages: poll in parallel (max 90s total)
  All 5 pages: publish simultaneously
  Total: ~90s max
```

Specifically:
1. Keep the existing sequential loop for **Facebook** (no polling needed for FB image posts)
2. For **Instagram** pages, collect all target pages into an array, then use `Promise.allSettled` to run `publishToInstagram()` for each page concurrently
3. Collect results from settled promises into `pageSuccesses` / `pageErrors` as before
4. Deduplication (`publishedIgIds`) must happen **before** launching parallel tasks — filter duplicates first, then parallelize

### File: `supabase/functions/social-cron-publish/index.ts`

Apply the same parallelization fix to the cron publisher's Instagram loop (lines 377-420).

### Stale Lock Recovery

The post `21b929c0` is currently stuck. The `recoverStaleLocks()` function should catch it on next cron run (>10 min old). No code change needed for this — it will self-heal.

## Impact
- 2 files changed (`social-publish/index.ts`, `social-cron-publish/index.ts`)
- Video publishing to 5 IG pages goes from ~450s worst case to ~90s
- No database or schema changes
- No frontend changes
- Facebook and LinkedIn publishing remain unchanged (already fast)

