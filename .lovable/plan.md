
# Fix: Odoo Migration Cron Job Auth (401 Loop)

## Problem
The `archive-odoo-files-batch` cron job is sending the **anon key** as the Authorization Bearer token. The edge function correctly requires either the **service role key** or a valid user session. The anon key is neither, so every call returns 401 and zero files get migrated.

Evidence: All recent calls show `status_code: 401`, and the count has been stuck at 751/18,323.

## Root Cause
The cron job was created with the anon key hardcoded in the `Authorization` header:
```
Bearer eyJhbGciOiJIUzI1NiIs...PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M
```
This is the anon key, not the service role key.

## Fix
Run a SQL migration to drop and recreate the cron job using the service role key fetched from the vault at runtime (rather than hardcoding it):

```sql
-- Drop the broken cron job
SELECT cron.unschedule('archive-odoo-files-batch');

-- Recreate with service role key from vault
SELECT cron.schedule(
  'archive-odoo-files-batch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/archive-odoo-files',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);
```

If the service role key is not yet stored in the vault, we will need to add it there first, or alternatively reference it via a database function.

**Alternative approach** (simpler, using current_setting): Since Supabase stores the service role key in `current_setting('supabase.service_role_key')` on some configurations, we can try that. If not available, we hardcode the correct key in the cron job command.

## Technical Details
- **File changed**: Database migration only (SQL)
- **No code changes needed** -- the edge function already handles service-role auth correctly
- **Expected result**: Cron fires every minute, gets 200 instead of 401, migration resumes at ~91 files/min
- **ETA to completion**: ~193 minutes (~3.2 hours) once unblocked

## Validation
- After deploying, monitor edge function logs for `archive-odoo-files: X migrated` messages instead of 401s
- The migration status card should start showing progress within 1-2 minutes
