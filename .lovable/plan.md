

# Fix: Scheduled Posts Not Publishing Automatically

## Root Cause

The `social-cron-publish` edge function exists and works correctly, but **there is no pg_cron job scheduling it to run automatically**. Other functions (ringcentral-sync, odoo-crm-sync, check-sla-breaches) have pg_cron jobs — but `social-cron-publish` was never given one. Posts sit in "scheduled" status indefinitely because nothing invokes the function.

Additionally, the query requires `neel_approved = true` — posts that are "Scheduled + Approved" in the UI but haven't been explicitly approved by Neel will also be skipped. From the screenshot, posts show "Scheduled · Approved" but may have `neel_approved = false`.

## Fix

### 1. Create a pg_cron job to call `social-cron-publish` every 5 minutes

A new database migration will schedule:

```sql
SELECT cron.schedule(
  'social-cron-publish',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/social-cron-publish',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

This runs every 5 minutes, checks for posts where `status = 'scheduled'`, `neel_approved = true`, and `scheduled_date <= now()`, then publishes them.

### 2. Verify approval flow alignment

The cron function queries `.eq("neel_approved", true)`. The approval UI in `PostReviewPanel.tsx` sets `neel_approved: true` when approved. The calendar shows "Approved" status — this should be consistent. No code change needed here, but the migration ensures the trigger exists.

## Impact

- Only adds a new cron job — no existing code or behavior is modified
- Posts will now automatically publish within 5 minutes of their scheduled time
- Stale lock recovery (already in the function) handles edge cases

## Files Changed
- New migration SQL — add pg_cron job for `social-cron-publish` every 5 minutes

