
# Fix: Odoo Sync Cron Jobs Failing with 401 Unauthorized

## Root Cause — Confirmed

The cron jobs were built when the sync functions used a simple anon-key-based auth check. They were later upgraded to use `requireAuth()` from `_shared/auth.ts`, which calls `userClient.auth.getClaims(token)` — a method that validates a **user JWT**, not an anon key.

All three cron jobs in the database pass the **anon key** as the Bearer token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (anon key, role: anon)
```

The `requireAuth()` function runs `getClaims()` on this token and expects `claims.sub` (a user ID) to be present. The anon key has no `sub` claim — it is a non-user service token — so `getClaims()` returns no `sub`, and the function throws a **401**. This has been happening silently every 15 minutes, meaning **no incremental Odoo CRM sync has run since the crons were installed**.

The edge function logs confirm: `POST | 401 | odoo-crm-sync`.

### Why `check-sla-breaches` still works

That function has its own auth logic that explicitly accepts the **service role key** as a valid token (`if (token !== serviceRoleKey)`). It does NOT use `requireAuth()`. This is the correct pattern for cron-invoked functions.

### Why `odoo-chatter-sync` is also broken

It calls `requireAuth(req)` on line 56 — same broken path as `odoo-crm-sync`.

---

## The Fix — Two Parts

### Part 1: Update Both Sync Functions to Accept Service-Role Calls

Replace the `requireAuth(req)` call at the top of `odoo-crm-sync` and `odoo-chatter-sync` with a pattern that:

1. Checks if the incoming token is the **service role key** — if so, grant full access (this is the cron path).
2. Falls back to the existing `requireAuth()` user-JWT path for manual UI-triggered calls.

The `check-sla-breaches` function already implements this correctly and serves as the model:

```ts
// Pattern used by check-sla-breaches — to be adopted by both sync functions
const authHeader = req.headers.get("Authorization") ?? "";
const token = authHeader.replace("Bearer ", "");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

if (token !== serviceRoleKey) {
  // Validate as a user JWT (manual trigger from UI)
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  // Optionally: check has_role admin for odoo sync
}
// serviceClient is ready for use
```

### Part 2: Update the Cron Jobs to Use the Service Role Key Instead of the Anon Key

The cron jobs currently pass the **anon key** hardcoded. They need to pass the **service role key** so the service-role path is taken.

This is done via a database migration that updates the `cron.job` commands:

```sql
-- Update odoo-crm-sync cron job to use service role key
SELECT cron.unschedule('odoo-crm-sync-incremental');
SELECT cron.schedule(
  'odoo-crm-sync-incremental',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-crm-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"mode":"incremental"}'::jsonb
    ) AS request_id;
  $$
);
```

However — `current_setting('app.service_role_key')` is not automatically available. The cleanest solution is to store the service role key as a database secret via `vault` or use a dedicated `cron_secret` custom setting, which is already the established pattern for `check-sla-breaches`.

The safest approach is to make the edge functions accept **both the anon key AND a valid user JWT** for the manual path, while accepting the **service role key** for the cron path — and update the cron jobs in the migration to pass the service role key via `current_setting`.

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/odoo-crm-sync/index.ts` | Replace `requireAuth(req)` with dual-path auth: accept service role key (cron) OR valid user JWT (manual) |
| `supabase/functions/odoo-chatter-sync/index.ts` | Same dual-path auth replacement |
| Database migration | `cron.unschedule` + `cron.schedule` both Odoo sync jobs, replacing the anon key in `Authorization` header with the service role key via `vault.decrypted_secrets` or a stored setting |

### Auth Flow After Fix

```text
pg_cron fires every 15 min
       |
       v
net.http_post → odoo-crm-sync
       |
       Authorization: Bearer <SERVICE_ROLE_KEY>
       |
       v
token === serviceRoleKey?
  YES → skip user validation, run sync with serviceClient
  NO  → validate JWT, check admin role, proceed or 401
```

No changes to the sync logic itself — only the authentication gate at the top of both functions changes.
