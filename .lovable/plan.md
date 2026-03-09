

# Plan: Fix Scheduled Posts Not Publishing On Time

## Root Cause Analysis

I investigated the full chain: cron job → edge function → database. The findings:

1. **Cron runs every 2 minutes** — could cause up to 2-minute delay
2. **The Schedule button does NOT send `scheduled_date`** in its mutation (lines 549-556). It relies on the date being saved separately via "Set Date" button. If the user changes the date but doesn't click "Set Date" first, the post gets `status: "scheduled"` without the correct `scheduled_date`.
3. **The cron function works** — tested it live, returns correct response, but finds "no posts due" because the scheduled_date may not be persisted properly.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` — Schedule button fix
- Include `scheduled_date: post.scheduled_date` explicitly in the `updatePost.mutate` call (line 549)
- Also include it in the duplicate post inserts (line 560-572)
- This ensures the scheduled_date is always persisted when clicking Schedule

### 2. Cron frequency: 2 min → 1 min
- Update the `pg_cron` schedule from `*/2 * * * *` to `* * * * *` via SQL
- This reduces maximum delay from 2 minutes to 1 minute

### 3. `supabase/functions/social-cron-publish/index.ts` — Better logging
- Add `console.log` for the query result count and any filter conditions
- Log each post's `scheduled_date` vs current time for debugging

## Technical Details

**Schedule button fix (PostReviewPanel.tsx line 549):**
```typescript
updatePost.mutate({
  id: post.id,
  status: "scheduled",
  qa_status: "scheduled",
  scheduled_date: post.scheduled_date, // ← ADD THIS
  platform: primary.platform,
  page_name: primary.page,
});
```

**Cron SQL update:**
```sql
SELECT cron.unschedule('social-cron-publish-every-2-min');
SELECT cron.schedule('social-cron-publish-every-min', '* * * * *', ...);
```

Three small changes across two files + one SQL update. No existing logic removed.

