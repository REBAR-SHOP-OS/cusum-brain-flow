

# Fix Odoo Migration Cron + Live Error Dashboard

## Problem
The cron job `archive-odoo-files-batch` fires every minute but uses `current_setting('supabase.service_role_key')` which does NOT exist on this Supabase instance -- producing an ERROR every 60 seconds and zero files migrated. The vault is also empty, so there's no fallback.

## Solution (3 parts)

### Part 1: Store Service Role Key in Vault + Fix Cron

Since `current_setting` doesn't work and the vault is empty, we need to:

1. **Insert the service role key into the vault** using `vault.create_secret()`
2. **Drop and recreate the cron job** to read the key from the vault at runtime

```sql
-- 1. Store the key in vault
SELECT vault.create_secret(
  '<SERVICE_ROLE_KEY>',
  'supabase_service_role_key',
  'Service role key for cron jobs'
);

-- 2. Reschedule the cron
SELECT cron.unschedule('archive-odoo-files-batch');
SELECT cron.schedule(
  'archive-odoo-files-batch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/archive-odoo-files',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);
```

The service role key value is already available as a Supabase secret (`SUPABASE_SERVICE_ROLE_KEY`), but it needs to be copied into the vault so `pg_cron` can access it. This will be done via a SQL insert operation.

### Part 2: Create `migration_logs` Table

A new table to capture each batch run result (written by the edge function):

```sql
CREATE TABLE public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  migrated INT DEFAULT 0,
  failed INT DEFAULT 0,
  remaining INT DEFAULT 0,
  elapsed_s NUMERIC DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'success' -- 'success', 'error', 'auth_error'
);

ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read migration logs"
  ON public.migration_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
```

### Part 3: Update Edge Function to Write Logs

Modify `supabase/functions/archive-odoo-files/index.ts` to insert a row into `migration_logs` after each batch, including on errors:

- On success: log migrated/failed/remaining counts
- On auth failure (401): log with `status = 'auth_error'`
- On crash/exception: log with `status = 'error'` and error message

### Part 4: Enhanced Status Card with Live Gear + Error Log

Rebuild `OdooMigrationStatusCard.tsx` to:

1. **Animated gear icon** -- spinning gear when migration is active (not done), static when complete
2. **Fetch recent `migration_logs`** alongside the count queries
3. **Show error panel** -- if latest logs have `status != 'success'` or `failed > 0`, display a collapsible error section with:
   - Red badge: "Errors Detected" or "Cron Failing"  
   - List of recent error messages from `migration_logs.errors`
   - Timestamp of last successful vs last failed run
4. **Live pulse indicator** -- green dot pulsing when last log is < 2 min old (cron is alive), red static dot when stale (cron stopped/crashing)

```text
+--------------------------------------------------+
| [Gear Icon]  Odoo File Migration    [Live Pulse]  |
|                                   [Status Badge]  |
|  ============================================  4% |
|  751 / 18,323 migrated                           |
|  17,572 remaining          ETA: ~3h 12m          |
|                                                   |
|  [!] Last Error (2m ago)                     [v]  |
|  > Upload 4521: bucket quota exceeded             |
|  > File 8832: Attachment not found or empty       |
+--------------------------------------------------+
```

### Files Changed

| File | Change |
|------|--------|
| Database | New `migration_logs` table + RLS policy |
| `supabase/functions/archive-odoo-files/index.ts` | Write batch results to `migration_logs` |
| `src/components/admin/OdooMigrationStatusCard.tsx` | Full rewrite: animated gear, live pulse, error log panel |

### Cron Fix Note

The service role key needs to be inserted into the vault. Since I can see `SUPABASE_SERVICE_ROLE_KEY` is already configured as an edge function secret, the actual value will be used in the vault insert SQL (executed as a data operation, not a migration).
