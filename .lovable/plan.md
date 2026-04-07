

# Fix: Scheduled Posts Still Not Publishing — Secret Mismatch

## Root Cause

The `social-cron-publish` cron job is failing every 5 minutes with **"Invalid or missing internal secret"** (403 Forbidden). The logs confirm this is happening right now (12:50, 12:55 UTC).

The `internalOnly: true` guard on `social-cron-publish` requires the Edge Function env var `INTERNAL_FUNCTION_SECRET` to exactly match the `x-internal-secret` header sent by the cron job. The cron job reads its value from `vault.decrypted_secrets`, but the Edge Function env var holds a **different value** — set across multiple previous secret update attempts that never synced correctly.

**15 posts scheduled for today are stuck in `scheduled` status** despite being approved.

## Fix — Two-Part Approach

### Part 1: Set a fresh, known secret value via the Edge Function secrets tool

Use `add_secret` / `update_secret` to set `INTERNAL_FUNCTION_SECRET` to a new deterministic value: `sync-2026-04-07-publish`

### Part 2: Update the vault to match (migration)

```sql
UPDATE vault.secrets 
SET secret = 'sync-2026-04-07-publish' 
WHERE name = 'INTERNAL_FUNCTION_SECRET';
```

### Part 3: Verify

Call `social-cron-publish` with header `x-internal-secret: sync-2026-04-07-publish` to confirm 200 response and posts start publishing.

## Fallback — If Secret Sync Continues to Fail

If the env var still doesn't match after setting it (which has happened 3 times already), the safest fix is to **remove the `internalOnly: true` guard** from `social-cron-publish` since:
- The function is already protected by the `Authorization: Bearer <anon_key>` header
- The cron job is the only caller
- This immediately unblocks publishing without any secret dependency

Change in `supabase/functions/social-cron-publish/index.ts` line 506:
```
// Before
{ functionName: "social-cron-publish", authMode: "none", requireCompany: false, wrapResult: false, internalOnly: true }

// After  
{ functionName: "social-cron-publish", authMode: "none", requireCompany: false, wrapResult: false, internalOnly: false }
```

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Update vault secret to match new value |
| Edge Function Secret | Update `INTERNAL_FUNCTION_SECRET` env var |
| `supabase/functions/social-cron-publish/index.ts` | (Fallback only) Set `internalOnly: false` |

## Impact
- Unblocks all 15 stuck posts immediately
- Cron job resumes publishing every 5 minutes
- No UI or schema changes

