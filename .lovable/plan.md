

# Fix: Stale Open Shifts + Prevent Recurrence

## Problem
6 employees show as ACTIVE because their `time_clock_entries` rows have `clock_out = null`. They left work but the system never closed their shifts. The auto-clockout edge function exists but either didn't run or the entries weren't old enough when it ran.

## Immediate Fix — Close Stale Shifts Now

**Option A (preferred):** Call the `auto-clockout` edge function with mode `evening` right now via `supabase--curl_edge_functions`. This will close any entries open >12h.

**Option B:** Create a database migration to directly UPDATE the 6 stale entries, setting `clock_out` to 6:00 PM today and adding a note.

## Systemic Fix — Add "Close All Stale Shifts" Admin Button

### File: `src/pages/TimeClock.tsx`

Add a button visible to admins in the team status header area:
- Label: "Close stale shifts" (with AlertTriangle icon)
- Only shows when there are entries open >10 hours
- On click: calls the `auto-clockout` edge function with mode `evening`
- Shows confirmation dialog first
- Refreshes entries after completion

### File: `src/hooks/useTimeClock.ts`

Add a `closeStaleShifts` function that invokes `auto-clockout` edge function and refetches entries.

## Additional Improvement — Auto-detect Stale Warning

In `TimeClock.tsx`, add a warning banner at the top of Team Status tabs when any shift has been open >10 hours:
- Yellow banner: "X employees have shifts open >10 hours"
- Links to the close button

## Impact
- Fixes the 6 stale entries immediately
- Gives admins a manual fallback for when auto-clockout misses entries
- No schema changes needed
- Only touches `TimeClock.tsx` and `useTimeClock.ts`

