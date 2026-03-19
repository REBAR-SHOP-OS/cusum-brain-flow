
# ✅ COMPLETED: Sync ALL Company RingCentral Calls

## What changed
- `supabase/functions/ringcentral-sync/index.ts` — CRON `syncAllUsers` now uses **account-level** RC API endpoints:
  - `GET /account/~/call-log` — fetches ALL extensions' calls in one pass
  - `GET /account/~/message-store` — fetches ALL extensions' SMS/voicemail/fax
  - `GET /account/~/extension` — maps RC extensions to local user profiles by email
- Each record is attributed to the correct employee via `extension.id → user_id` mapping
- Pagination with 200ms rate-limit delay handles large volumes
- Per-user sync path (UI-triggered) remains unchanged as fallback
- `integration_connections` is updated for all users who had data

## Files updated
- `supabase/functions/ringcentral-sync/index.ts`
