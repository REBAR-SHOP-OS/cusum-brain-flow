

## Audit: RingCentral Shows "Connected" But Sync is 96 Hours Stale

### Root Cause

**`check-status` is blindly overwriting sync failure status.** Two systems are fighting over the same DB row:

1. **`ringcentral-sync` (cron, every 5 min)** — When it fails, it correctly sets `integration_connections.status = "error"` with an error message
2. **`ringcentral-oauth` check-status (user visits Integrations page)** — Lines 132-141: If a `user_ringcentral_tokens` row exists, it unconditionally upserts `status: "connected"` and `error_message: null` — **without testing if the token actually works**

So the flow is:
- Sync fails → status set to `"error"`
- User opens Integrations page → `checkAllStatuses` fires → check-status sees token row → blindly resets to `"connected"`
- UI shows green "Connected" badge next to the red "96 hours stale" warning — contradictory

The staleness warning is working correctly (it checks `last_sync_at`). The badge is wrong (it trusts `status` which gets overwritten).

### Secondary Issue: Sync Silent Failure

The edge function logs show `"ringcentral-sync invoked"` but zero output after that — no "CRON MODE", no error, nothing. The function is either:
- Crashing with an unhandled error in `getAccessTokenForUser` or `buildExtensionUserMap`
- Timing out during paginated RC API calls
- Completing with 0 records (but that should still log the summary)

We need more granular logging to diagnose the actual sync failure.

### Fix: 2 Files

#### Fix 1: Make check-status respect sync state
**File**: `supabase/functions/ringcentral-oauth/index.ts` (lines 132-141)

Before blindly setting "connected", check if the current `integration_connections` row has `status: "error"` AND a recent `updated_at`. If so, preserve the error status — don't overwrite it. Only set "connected" if there's no existing error or if `last_sync_at` is recent (within 12 hours).

```text
Logic:
1. Read current integration_connections row
2. If status is "error" AND last_sync_at is stale (>12 hours), keep the error status
3. Only upsert "connected" if last_sync_at is recent OR no existing row
4. Always update last_checked_at regardless
```

#### Fix 2: Add granular logging to syncAllUsers
**File**: `supabase/functions/ringcentral-sync/index.ts`

Add `console.log` at these critical points inside `syncAllUsers`:
- After entering the function: `"CRON: syncAllUsers started"`
- After finding token rows: `"CRON: Found N token rows"`
- After successful token acquisition: `"CRON: Token acquired for user X"`
- Before each API call type (calls, SMS, voicemail, fax): `"CRON: Starting call sync..."`
- Wrap the `buildExtensionUserMap` call in its own try/catch with explicit error logging (currently it's inside the for-loop catch which swallows context)

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/ringcentral-oauth/index.ts` | check-status respects existing error state instead of blindly overwriting |
| `supabase/functions/ringcentral-sync/index.ts` | Add granular logging at every stage of syncAllUsers |

