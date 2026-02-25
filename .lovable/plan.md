

## Fix: Multiple Cron Job Authentication Failures

### Issues Found

**Issue 1: `check-sla-breaches` cron (Job 3) — Using anon key instead of service role key**

The cron job uses the **anon key** (`eyJhbG...NkY`) as the Bearer token. The edge function's auth logic:
1. Checks if token === service role key (it doesn't match -- anon key != service role key)
2. Falls back to user auth check via `getUser()` 
3. `getUser()` returns null because the anon key has no user session
4. Returns 401 Unauthorized

This means **SLA breach checks have been silently failing every 30 minutes**.

**Issue 2: Jobs 4 and 5 — Already fixed**

The `odoo-crm-sync` and `odoo-chatter-sync` cron jobs were updated in the previous fix and now use the correct service role key.

**Issue 3: Live/production environment**

The production environment (`uavzziigfnqpfdkczbdo`) shows `ringcentral-sync` and `qb-sync-engine` returning 401 every minute. These are on the Live environment and likely have the same stale-key issue. Additionally, `unrecognized configuration parameter "supabase.service_role_key"` errors fire every 60 seconds — likely from a cron job or trigger that references a non-existent Postgres setting. These will need fixing after publish or separately.

### Fix Plan

**Step 1: Update `check-sla-breaches` cron job (Job 3)**

Run a SQL migration to update Job 3 to use the service role key instead of the anon key:

```sql
SELECT cron.alter_job(
  3,
  command := $cronCmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/check-sla-breaches',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_awjjbBcZsNcBcUjnog9g5Q_BJkWbAlM'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cronCmd$
);
```

**Step 2: Verify the fix**

After the migration, wait for the next 15-minute and 30-minute cron intervals and check `net._http_response` for 200 status codes instead of 401s.

### What This Fixes
- SLA breach detection will resume running every 30 minutes
- Combined with the previous fix, all 3 test-environment cron jobs will authenticate correctly

### What This Does NOT Fix (Live Environment)
- The `ringcentral-sync` and `qb-sync-engine` 401 errors on the Live environment are a separate issue requiring the same type of cron key update on that environment after publishing
- The `unrecognized configuration parameter "supabase.service_role_key"` errors on Live need investigation into what cron job or trigger references that setting

### No Code Changes Needed
- All edge function code is correct
- No frontend changes required
- Only the database-level cron configuration needs updating

