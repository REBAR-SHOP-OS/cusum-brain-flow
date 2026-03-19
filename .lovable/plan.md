

# Fix Vizzy's False RingCentral Stale Warning + Banned Phrases

## Problem Summary

Three issues persist despite previous fixes:

1. **Vizzy warns about "stale" RingCentral even when sync is healthy** — The context builder (`vizzyFullContext.ts`) only checks the last call timestamp in `communications`. It never queries `integration_connections.last_sync_at`. When there are no new calls (quiet day), it emits an `ℹ️` info line that Vizzy still escalates as a sync problem.

2. **Vizzy uses banned phrases** — "Would you like me to proceed with that?" is explicitly banned but still appears. The enforcement language needs to be stronger.

3. **RC data already covers all employees** — The queries have no `user_id` filter, so all company calls are included. No change needed here.

## Step 1 — Add `integration_connections` check to context builder

**File: `supabase/functions/_shared/vizzyFullContext.ts`**

- Add a new query in the parallel data-fetch block (around line 240) to get RingCentral sync status:
  ```sql
  SELECT last_sync_at, status FROM integration_connections 
  WHERE integration_id = 'ringcentral' 
  ORDER BY last_sync_at DESC LIMIT 1
  ```
- Replace the staleness detection block (lines 737-759) with smarter logic:
  - If `integration_connections` shows `status = 'connected'` AND `last_sync_at` is within 2 hours → emit **no warning at all**, just a neutral line: `"Sync is running normally. No calls recorded today."`
  - If `last_sync_at` is stale (>12h) OR status is `'error'` → emit the `⚠️` warning
  - If no `integration_connections` row exists → fall back to current call-based staleness logic

## Step 2 — Fix SYNC AWARENESS and reinforce banned phrases

**File: `src/hooks/useVizzyVoiceEngine.ts`**

- Update SYNC AWARENESS section (lines 206-211): Add rule — "If the data says 'Sync is running normally', do NOT mention sync at all. Only flag sync problems when you see the ⚠️ emoji."
- Add to BANNED PHRASES (line 190-204):
  - "Would you like me to proceed with that?"
  - "Would you like me to proceed?"
  - Any variation of "proceed with that"
- Add enforcement line: "If you catch yourself about to say a banned phrase, STOP and rephrase immediately."

## Step 3 — Deploy edge functions

Deploy all functions that use `vizzyFullContext.ts`: `admin-chat`, `vizzy-daily-brief`, `vizzy-pre-digest`, and any others sharing the module.

## Files Modified
1. `supabase/functions/_shared/vizzyFullContext.ts` — query `integration_connections`, fix staleness logic
2. `src/hooks/useVizzyVoiceEngine.ts` — fix SYNC AWARENESS rules, add banned phrases

## Expected Result
- Vizzy will NOT mention RingCentral sync when the connection is healthy and there are simply no new calls
- Banned phrases like "Would you like me to proceed?" will be more aggressively blocked
- All employee RC data continues to be included (already working)

