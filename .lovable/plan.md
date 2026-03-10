

# Fix: Scheduled Posts Not Publishing — Root Cause Found

## Problem
The `social-cron-publish` cron job (pg_cron job #9) is calling the **wrong project URL**. It points to `uavzziigfnqpfdkczbdo` (the old project) instead of `rzqonxnowjrtbueauziu` (the current project). This means the edge function **never executes** on the correct backend — confirmed by zero logs and "0 rows" on every cron run.

There are 2 overdue posts stuck in "scheduled" status right now:
- `d8f2a90b` — Rebar.shop Instagram — scheduled Mar 6 (4 days overdue)
- `10ebf614` — Rebar.shop Instagram — scheduled Mar 10 15:20 UTC (just passed)

## Root Cause
```text
CRON JOB #9 URL:  uavzziigfnqpfdkczbdo.supabase.co  ← WRONG
ACTUAL PROJECT:   rzqonxnowjrtbueauziu.supabase.co  ← CORRECT
```

The edge function code itself is correct. The publishing logic works. It's just never being called.

## Fix

### 1. Update pg_cron job to correct URL + increase to every minute
Run via SQL (not migration — contains project-specific secrets):

```sql
SELECT cron.unschedule(9);

SELECT cron.schedule(
  'social-cron-publish-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/social-cron-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

This fixes the URL and changes from every-5-minutes to every-minute for more precise scheduling (within ~60 seconds of the scheduled time).

### 2. Fix timezone handling in PostReviewPanel
The scheduling UI uses browser local time which is correct, but we should explicitly set `America/Toronto` as the organizational timezone to ensure consistency:

- In `DateSchedulePopover`, add a label showing the timezone ("Eastern Time") so users know what timezone they're scheduling in.
- No backend change needed — the `Date.toISOString()` already converts local → UTC correctly.

### 3. Edge function hardening
In `social-cron-publish/index.ts`:
- Add a `last_publish_attempt` timestamp column update to prevent retry storms if the function times out mid-publish.
- Add logging for the timezone context.

## Files Modified
- **SQL** (cron job update) — fix URL, increase frequency
- `src/components/social/PostReviewPanel.tsx` — add timezone label
- `supabase/functions/social-cron-publish/index.ts` — add retry protection

