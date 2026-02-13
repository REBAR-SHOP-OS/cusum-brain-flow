

# Fix: Odoo Migration Cron Job Auth (Stuck at 751)

## Problem
The `archive-odoo-files-batch` cron job fires every minute but **zero files are being processed**. The migration has been stuck at 751/18,323 since the cron was created.

**Root cause**: The cron job sends the **anon key** as the Authorization header. The edge function then calls `auth.getUser()`, which fails because the anon key is not a user session token. Every invocation returns 401 silently.

## Fix

**Modify `supabase/functions/archive-odoo-files/index.ts`** to accept the **service role key** as an alternative auth method (for cron/automated calls), while keeping user auth for manual triggers.

Replace the auth block (lines 70-94) with:

```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const token = authHeader.replace("Bearer ", "");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allow service-role calls (from cron) OR authenticated user calls
if (token !== serviceRoleKey) {
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

Then **update the cron job** to use the service role key instead of the anon key:

```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'archive-odoo-files-batch'),
  command := $$
  select net.http_post(
    url := 'https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/archive-odoo-files',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

(The actual service role key value will be pulled from the existing `SUPABASE_SERVICE_ROLE_KEY` secret.)

## Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/archive-odoo-files/index.ts` | Accept service role key as valid auth for automated calls |
| Database (cron job) | Update `archive-odoo-files-batch` to use service role key |

## What This Does NOT Touch
- No financial tables
- No Odoo proxy fallback removal
- No other edge functions
- OdooMigrationStatusCard component stays as-is

## Expected Result
After deploying, the cron will authenticate successfully and process ~91 files/minute. The CEO Portal card will start showing progress updates on the next poll.

