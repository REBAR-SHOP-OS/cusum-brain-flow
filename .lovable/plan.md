

# Fix: Scheduled Posts Not Publishing — Missing Internal Secret

## Root Cause

The `social-cron-publish` function was recently updated to require `internalOnly: true`, which demands the `x-internal-secret` header matching the `INTERNAL_FUNCTION_SECRET` environment variable. **Both are missing:**

1. The **pg_cron job** calls `social-cron-publish` every 5 minutes but does **not** include the `x-internal-secret` header
2. The **`INTERNAL_FUNCTION_SECRET` env var** is not set as an Edge Function secret
3. The **vault secret** `INTERNAL_FUNCTION_SECRET` also does not exist in `vault.secrets`

This means every cron invocation immediately fails with `"INTERNAL_FUNCTION_SECRET not configured"` and returns a 500 error. No posts get published. This affects **15 internal functions** including social publishing, push notifications, escalation checks, email automation, and pipeline automation.

**6 posts** scheduled for this morning (10:30 AM, 12:00 PM UTC) are stuck in `scheduled` status despite being approved.

## Fix — Two Steps

### Step 1: Create the secret
Generate a random `INTERNAL_FUNCTION_SECRET` value and set it in two places:
- As an **Edge Function secret** (so `Deno.env.get("INTERNAL_FUNCTION_SECRET")` works)
- In the **Supabase vault** (so `get_internal_function_secret()` works for DB triggers)

### Step 2: Update the cron job to pass the header
Update the pg_cron job for `social-cron-publish` (and the duplicate job) to include the `x-internal-secret` header in the HTTP request, matching how the DB trigger functions already do it via `get_internal_function_secret()`.

Migration SQL:
```sql
-- Insert secret into vault
INSERT INTO vault.secrets (name, secret)
VALUES ('INTERNAL_FUNCTION_SECRET', gen_random_uuid()::text);

-- Update cron job to pass the internal secret header
SELECT cron.unschedule(21);
SELECT cron.unschedule(32);

SELECT cron.schedule(
  'social-cron-publish',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/social-cron-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

Then set the same secret value as an Edge Function env var using `add_secret`.

### Files Changed

| Change | Detail |
|--------|--------|
| **Migration SQL** | Insert vault secret, recreate cron jobs with `x-internal-secret` header |
| **Edge Function Secret** | Add `INTERNAL_FUNCTION_SECRET` env var |

### Impact
- Fixes social publishing cron (6 posts will publish on next 5-min tick)
- Fixes **all 15 internal cron/system functions** that use `internalOnly: true`
- No code changes needed — the functions already work, they just need the secret
- The 6 stuck morning posts will auto-publish once the fix is deployed

