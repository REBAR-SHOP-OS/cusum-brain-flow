

# Fix: RingCentral Sync Cron Silently Failing (0 Calls)

## Root Cause

The database has a cron job (`ringcentral-sync-every-minute`) that fires every minute, but it sends the **anon key** as the Authorization bearer. The `ringcentral-sync` function calls `verifyAuth()` which expects a **user JWT** to extract `user_id`. The anon key is not a user JWT, so `verifyAuth` returns `null` → the function returns **401 Unauthorized** silently, every single minute. No calls have been synced since Feb 25 (22+ days ago).

```text
Cron → POST ringcentral-sync (Authorization: Bearer <anon_key>)
  → verifyAuth() tries getClaims(<anon_key>) → fails → null
  → returns 401 Unauthorized
  → no sync happens
  → repeat every minute forever
```

## Fix

### 1. Add cron/service-role mode to `ringcentral-sync`

When the function detects a **service role key** (not a user JWT), it enters "cron mode":
- Query `user_ringcentral_tokens` for ALL users with active tokens
- Loop through each user and sync their calls/SMS/voicemail/fax
- Return aggregated results

```text
Cron → POST ringcentral-sync (Authorization: Bearer <service_role_key>)
  → detect service role → cron mode
  → query user_ringcentral_tokens → [sattar, ben, saurabh]
  → for each user: getAccessToken → fetchCallLog → upsert
  → return { users_synced: 3, total_calls: 47 }
```

### 2. Update the cron job SQL

Replace the anon key with the service role key in the cron job:

```sql
UPDATE cron.job 
SET command = $$ 
  SELECT net.http_post(
    url := '...',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{"syncType": "all", "daysBack": 1}'::jsonb
  ) AS request_id;
$$ WHERE jobname = 'ringcentral-sync-every-minute';
```

Also change the schedule from every minute to every 15 minutes (`*/15 * * * *`) — every-minute is excessive and wastes RC API quota.

### 3. Changes in `supabase/functions/ringcentral-sync/index.ts`

Add at the top of the handler (after OPTIONS check):

```typescript
// Detect cron/service-role calls vs user JWT calls
const authHeader = req.headers.get("Authorization") || "";
const token = authHeader.replace("Bearer ", "");

// Try user auth first
let userId = await verifyAuth(req);

if (!userId) {
  // Check if this is a service-role call (cron mode)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (token === serviceRoleKey) {
    // CRON MODE: sync all users with RC tokens
    return await syncAllUsers(req);
  }
  return 401;
}
// ... existing single-user sync logic
```

New `syncAllUsers()` function:
- Creates admin client
- Queries all rows from `user_ringcentral_tokens`
- For each user: calls existing sync logic (getAccessTokenForUser → fetch → upsert)
- Catches per-user errors (expired tokens) without failing the whole batch
- Returns summary

### Technical details

- No database schema changes needed
- The existing per-user sync (from Inbox UI) continues to work unchanged
- Expired tokens (ben, saurabh) will fail gracefully per-user, while active tokens (Sattar) will succeed
- First successful cron run will backfill the last 1 day of calls; a one-time manual sync with `daysBack: 30` can recover the 22-day gap

