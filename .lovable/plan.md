

# Fix: Posts Stuck in "Publishing..." State

## Problem
Posts that were published days ago still show "publishing" with a spinner. Two root causes:

1. **Missing label**: `SocialCalendar.tsx` has no entry for `"publishing"` in `STATUS_LABELS` (line 25-31), so it renders the raw DB string
2. **No stale recovery**: `social-cron-publish` sets `status: "publishing"` (line 160) before attempting to publish. If the edge function times out or crashes mid-flight, posts stay stuck forever — the catch block never fires

## Solution

### 1. Add "publishing" label to calendar (SocialCalendar.tsx, line 25-31)
Add `publishing: "Publishing 🔄"` to `STATUS_LABELS` so the calendar displays it cleanly instead of raw text.

### 2. Add stale-publishing cleanup to cron (social-cron-publish, ~line 120)
Before fetching due posts, run a cleanup query that resets any post stuck as `"publishing"` for more than 10 minutes back to `"scheduled"` so it gets retried on the next cron run:

```sql
UPDATE social_posts
SET status = 'scheduled'
WHERE status = 'publishing'
  AND updated_at < now() - interval '10 minutes'
```

This handles edge function timeouts, crashes, and any other failure mode that bypasses the catch block.

## Files Changed
- `src/components/social/SocialCalendar.tsx` — add `publishing` to `STATUS_LABELS`
- `supabase/functions/social-cron-publish/index.ts` — add stale-publishing recovery query before main fetch

