

# Fix: Cron Job Authentication Failure

## Root Cause
Job #13 fails every single run with:
```
ERROR: unrecognized configuration parameter "supabase.service_role_key"
```

`current_setting('supabase.service_role_key')` is not available inside pg_cron's execution context. The edge function is **never called**.

## Fix
Unschedule job #13 and create a new one using the **anon key** directly (hardcoded), same pattern used by the working jobs (#8, #10, #11).

```sql
SELECT cron.unschedule(13);

SELECT cron.schedule(
  'social-cron-publish-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/social-cron-publish',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6cW9ueG5vd2pydGJ1ZWF1eml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODE2NTMsImV4cCI6MjA4NzE1NzY1M30.3-ryGO4oXzW_4NET5cKYrw0hAI8oY4vvYnuYp5Q6NkY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

The edge function `social-cron-publish` already uses `SUPABASE_SERVICE_ROLE_KEY` internally via Deno env, so anon key in the HTTP call header is sufficient to invoke it — the function itself escalates to service role for DB operations.

**Single SQL change. No code files modified.**

