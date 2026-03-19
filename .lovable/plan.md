

# Auto-Healing 24/7 Sync for Gmail and RingCentral

## Overview

Implement automated cron-based sync with self-healing token management so data flows 24/7 without manual intervention.

## Changes

### 1. Add cron sync mode to `gmail-sync` edge function

**File:** `supabase/functions/gmail-sync/index.ts`

Add a `syncAllUsers()` function (matching the existing pattern in `ringcentral-sync`) that:
- Activates when called with anon/service key (no user JWT) — same pattern as RC's line 429-446
- Queries all rows from `user_gmail_tokens` via service role
- For each user: refreshes token, syncs last 1 day of emails, upserts to `communications`
- On `invalid_grant`: marks `integration_connections` status to `error` with message "Token expired — please reconnect" so the UI auto-shows a Reconnect button
- Continues to next user on failure (no single user breaks the batch)

### 2. Self-healing: auto-mark integration status on token failure

**Files:** `supabase/functions/gmail-sync/index.ts` and `supabase/functions/ringcentral-sync/index.ts`

In both functions' cron mode, when a token refresh fails with `invalid_grant` or equivalent:
- Upsert to `integration_connections` setting `status = 'error'` and `error_message = 'Token expired — please reconnect'`
- The existing `ringcentral-sync` already deletes stale tokens but doesn't update `integration_connections` — add that

### 3. Schedule pg_cron jobs (every 5 minutes)

**Via SQL insert (not migration — contains project-specific URLs/keys):**

Two cron jobs:
- `gmail-cron-sync`: calls `gmail-sync` every 5 minutes with anon key
- `ringcentral-cron-sync`: calls `ringcentral-sync` every 5 minutes with anon key

Both use the existing architecture: anon key triggers the function, function escalates internally via service role key.

### 4. Gmail Watch (Pub/Sub) auto-renewal

**File:** `supabase/functions/gmail-sync/index.ts`

Add handling for a `renewWatch` action in the cron path that calls `gmail.users.watch()` for each user with tokens. Schedule a daily cron job for this to keep push notifications alive (they expire every 7 days).

### 5. Staleness alert banner on Integrations page

**File:** `src/pages/Integrations.tsx`

On mount, query `MAX(received_at)` from `communications` grouped by source. If any source has no data for 12+ hours, show a warning banner:
```
⚠️ Gmail sync appears stale — last data received 18 hours ago
```

## Technical Details

- RingCentral already has `syncAllUsers()` (line 257) — Gmail needs the same pattern
- Both functions already have `verify_jwt = false` in config.toml
- `integration_connections` table has `user_id`, `integration_id`, `status`, `error_message` columns with per-user RLS
- Cron uses anon key per project memory (service_role not accessible in pg_cron context)

