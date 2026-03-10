

# Fix: Morning Auto-Clockout Time 8 AM → 6 AM

Change the morning reset from 8 AM ET to **6 AM ET** for all workers (office + shop).

## Changes

### 1. `supabase/functions/auto-clockout/index.ts`
- Line 48: Update hour guard from `< 7 || > 9` to `< 5 || > 7` (expect ~6 AM)
- Line 49: Update log message from "expected ~8 AM" to "expected ~6 AM"
- Line 74: Update notes from `"[auto-closed: 8 AM morning reset]"` to `"[auto-closed: 6 AM morning reset]"`

### 2. Cron schedule (if configured externally)
The cron trigger that calls this function with `mode: "morning"` must also be updated to fire at 6 AM ET instead of 8 AM. This is likely configured outside the code (e.g., in the backend cron settings).

No other files need changes — the clock-in restriction (6 AM minimum) in `useTimeClock.ts` and `kiosk-punch/index.ts` is already set to 6 AM and remains correct.

