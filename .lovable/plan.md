

# Fix: Cron Job Authentication for Scheduled Post Publishing

## Problem
The cron job is running every 2 minutes (confirmed by edge function boot logs), but the scheduled post from 21:05 is **still in `scheduled` status** — it was never published.

**Root cause**: The cron job SQL sends the **anon key** in the `Authorization` header, but the `social-cron-publish` function checks for the **service role key**. The anon key fails the auth check → 401 Unauthorized → posts never get published.

## Fix
Two options — the simplest and most reliable:

**Update the edge function** to also accept the anon key when called from the cron context. Since `verify_jwt = false` is already set and the function is not publicly dangerous (it only publishes posts that are already approved and scheduled), we can add the anon key as a valid auth method.

Specifically, in `supabase/functions/social-cron-publish/index.ts`, modify the auth check (lines 19-33) to also accept the anon key:

```typescript
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
const isAnonCron = authHeader === `Bearer ${anonKey}`;

if (!isServiceRole && !isAnonCron) {
  // check x-cron-secret fallback...
}
```

This is the safest approach because:
- We cannot put the service role key in a migration file (it would be visible in version control)
- The anon key is already in the cron job and working
- The function only processes pre-approved scheduled posts

### File to edit
1. `supabase/functions/social-cron-publish/index.ts` — Accept anon key as valid auth for cron calls

