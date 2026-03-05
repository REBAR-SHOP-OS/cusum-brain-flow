

# Auto-Publish Scheduled Posts via Cron Job

## Problem
The `social-cron-publish` edge function already exists and correctly finds posts where `status = 'scheduled'` and `scheduled_date <= now()`, then publishes them. However, **no cron job is configured to invoke it**, so scheduled posts just sit there and never get published.

## Solution
Create a database migration that registers a `pg_cron` job to call the `social-cron-publish` edge function every 2 minutes using `pg_net`. This ensures any post whose scheduled time has passed gets automatically published.

### Database Migration (1 file)
Add a `cron.schedule` entry that fires every 2 minutes, calling:
```
POST {SUPABASE_URL}/functions/v1/social-cron-publish
Authorization: Bearer {SERVICE_ROLE_KEY}
```

Using `pg_net.http_post` (already enabled via the `pg_net` extension).

### Edge Function Config
Add `social-cron-publish` to `supabase/config.toml` with `verify_jwt = false` so the cron call (using service role key) isn't rejected.

### Files to change
1. **New migration SQL** — `cron.schedule` every 2 minutes calling the edge function
2. **`supabase/config.toml`** — Add `[functions.social-cron-publish]` with `verify_jwt = false`

No frontend changes needed — the scheduling UI already sets `status: "scheduled"` and `scheduled_date` correctly.

