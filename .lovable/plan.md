

## Root Cause Analysis: Staleness Warnings

### What's happening

The Gmail and RingCentral staleness warnings appear because `last_sync_at` in `integration_connections` is stale, even though the syncs are actually running.

### Root Causes Found

**1. Gmail: Single-user sync never updates `last_sync_at`**
When you open Inbox or trigger a manual sync, the function uses the authenticated-user path (line 569+) which syncs emails but **never calls `markIntegrationSynced`**. Only the cron path updates `last_sync_at`. Your Gmail `last_sync_at` is stuck at March 19.

**2. RingCentral: Sync only updates `last_sync_at` for users with new data**
The cron only adds users to `usersSeen` when they have new calls/SMS. If no new RingCentral activity exists, `last_sync_at` never gets updated — even though the sync ran fine. Your RC `last_sync_at` is stuck at March 24 00:11 (18 hours ago).

**3. `activity_events` ON CONFLICT error (minor)**
The `dedupe_key` unique index is partial (`WHERE dedupe_key IS NOT NULL`), but the upsert uses `onConflict: "dedupe_key"` without the WHERE clause. PostgreSQL rejects this. Non-fatal but causes error spam.

### Fix Plan

| File | Change |
|---|---|
| `supabase/functions/gmail-sync/index.ts` | Add `markIntegrationSynced` call at end of single-user sync path (after line 717) |
| `supabase/functions/ringcentral-sync/index.ts` | Move `last_sync_at` update outside `usersSeen` loop — always update for the admin user AND all users with RC connections, regardless of whether new data was found |
| DB migration | Add a proper non-partial unique constraint on `activity_events.dedupe_key`, or change the upsert to use `INSERT ... ON CONFLICT` with the partial index condition |

### Detailed Changes

**Gmail fix** (`gmail-sync/index.ts`, after line 717):
- After the for-loop that upserts communications in the single-user path, call `markIntegrationSynced(supabaseAdmin, userId, "gmail")` so that every manual/frontend sync also refreshes `last_sync_at`.

**RingCentral fix** (`ringcentral-sync/index.ts`, lines 590-614):
- After the data sync loop, query ALL users with a `ringcentral` integration connection and update their `last_sync_at` — not just users who had new data. This ensures a successful "no new data" run still shows the sync is healthy.

**Activity events fix** (DB migration):
- Drop the partial unique index `idx_activity_events_dedupe_key`
- Create a full unique constraint: `ALTER TABLE activity_events ADD CONSTRAINT activity_events_dedupe_key_unique UNIQUE (dedupe_key)`
- This makes the `ON CONFLICT dedupe_key` clause work correctly

