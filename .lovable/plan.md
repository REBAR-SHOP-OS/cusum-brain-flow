

## Fix: Pipeline Sync Failing with 401 Unauthorized

### Root Cause

The `pg_cron` jobs that trigger `odoo-crm-sync` (every 15 min) and `odoo-chatter-sync` (every hour) are using a **hardcoded, stale service role key** (`F-j9cIax9-aAT_52qTKKfuKPsODxK9In`) in their HTTP Authorization headers. This key no longer matches the actual `SUPABASE_SERVICE_ROLE_KEY`, so every automated sync call returns `{"error":"Unauthorized"}` (HTTP 401).

Evidence from the `net._http_response` table:
- Every 15-minute call returns `401 Unauthorized`
- Some calls also time out (5-second `pg_net` default timeout)
- Last successful sync data in `sync_validation_log` is from **Feb 20** (5 days ago)

### Fix

**Update the two `pg_cron` jobs** to use the correct, current service role key via a SQL migration.

The migration will:

1. Retrieve the current service role key from the `supabase_functions.secrets` metadata (or use the vault)
2. Update the `odoo-crm-sync-incremental` cron job (jobid 4) with the correct Bearer token
3. Update the `odoo-chatter-sync-hourly` cron job (jobid 5) with the correct Bearer token

To avoid hardcoding the key again (which caused this problem), the fix will use `current_setting('supabase.service_role_key')` or reconstruct the key dynamically. However, since `pg_cron` stores the command as a static string, we need to use the actual key value at migration time.

**SQL Migration:**

```sql
-- Update odoo-crm-sync-incremental cron job with correct service role key
SELECT cron.alter_job(
  4,
  command := format(
    $cmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-crm-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer %s'
      ),
      body := '{"mode":"incremental"}'::jsonb
    ) AS request_id;
    $cmd$,
    current_setting('supabase_admin.service_role_key')
  )
);

-- Update odoo-chatter-sync-hourly cron job with correct service role key
SELECT cron.alter_job(
  5,
  command := format(
    $cmd$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-chatter-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer %s'
      ),
      body := '{"mode":"missing"}'::jsonb
    ) AS request_id;
    $cmd$,
    current_setting('supabase_admin.service_role_key')
  )
);
```

If the `current_setting` approach doesn't work in migration context, the alternative is to read the key from Vault or hardcode the current key (less ideal but functional).

### No Code Changes Needed

- The edge function code (`odoo-crm-sync/index.ts`) is correct -- it properly validates the service role key
- The frontend sync trigger (`Pipeline.tsx` handleOdooSync) works fine for manual syncs since it uses `supabase.functions.invoke()` which automatically includes the user's JWT
- The `SyncHealthDashboard` component is correct

### What Stays the Same
- All edge function code
- All frontend components
- Database schema
- Cron schedules (every 15 min / every hour)
