

## Root Cause: Scheduled posts never publish

The cron job `social-cron-publish` is **failing with 401 Unauthorized on every single call**. Evidence from the `net._http_response` table shows continuous `{"error":"Unauthorized"}` responses.

**Two problems:**

1. **Missing vault secret**: The cron job SQL references `vault.decrypted_secrets WHERE name = 'service_role_key'` — but this secret does not exist in the vault. The query returns no rows, so the Authorization header is empty/null.

2. **JWT verification enabled**: The edge function `social-cron-publish` does not have `verify_jwt = false` in `config.toml`, so even with a valid anon key it would still reject unauthenticated requests.

### Fix

**Step 1**: Add `verify_jwt = false` to `supabase/config.toml` for the cron function:
```toml
[functions.social-cron-publish]
verify_jwt = false
```

**Step 2**: Replace the cron job SQL to use the hardcoded anon key (per the established architecture pattern — the edge function already uses `SUPABASE_SERVICE_ROLE_KEY` internally):
```sql
SELECT cron.unschedule('social-cron-publish-every-5min');

SELECT cron.schedule(
  'social-cron-publish-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/social-cron-publish',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdnp6aWlnZm5xcGZka2N6YmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzA5MDYsImV4cCI6MjA4NTkwNjkwNn0.PPat1nPMvVVGu2hqihmS4pdJ73sBiRw5xdv8AkqNT9M"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

**Step 3**: Also update the function to remove the auth requirement since it's called by cron (it already uses service role internally). The function currently uses `serve()` without auth gating, so this is just the config change.

After these changes, the cron will successfully invoke the function every 5 minutes, find due scheduled posts, and publish them.

