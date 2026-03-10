

# Investigation: Scheduled Post Not Publishing

## Findings

1. **The post exists and IS scheduled**: Post `10ebf614` — "Unlock structural integrity..." — has `status = 'scheduled'`, `qa_status = 'scheduled'`, `scheduled_date = 2026-03-10 16:05 UTC`, platform = instagram, page = Rebar.shop. There's also an older stuck post from March 6.

2. **The cron job IS running**: Job #14 fires every minute, the edge function boots/shuts down regularly.

3. **The edge function returns "No posts due"**: Manual invocation returned `{"message":"No posts due for publishing","published":0}` — meaning the query `status = 'scheduled' AND scheduled_date <= now` returned 0 rows from inside the function.

4. **Root cause**: The edge function's Supabase client cannot see the scheduled posts. Most likely the **deployed version of `social-cron-publish` is stale** — it may have an older query, different filters, or was never redeployed after code changes. The function boots and runs, but the deployed code does not match what's in the repo.

## Fix

1. **Redeploy `social-cron-publish`** — force a fresh deployment to ensure the live function matches the repo code.

2. **Add explicit debug logging** before and after the query so future issues are diagnosable:
   ```typescript
   console.log(`Querying scheduled posts. Current UTC: ${now}`);
   // ... query ...
   console.log(`Query returned ${duePosts?.length ?? 0} posts, error: ${fetchError?.message ?? 'none'}`);
   ```

3. **After redeploy, manually invoke** the function to verify it finds the 2 scheduled posts and publishes them.

## Files to Patch
- `supabase/functions/social-cron-publish/index.ts` — add 2 debug log lines (lines ~27 and ~40)
- Redeploy the function

No DB changes needed. The data is correct; the deployed function just can't see it.

