

# Fix: "You already have an open shift" — Stale Shifts From Previous Days

## Problem
The DB trigger `block_multiple_open_shifts` checks **all** open shifts (no date filter), but `useTimeClock` only fetches **today's** entries. So if a user forgot to clock out yesterday, the UI shows "Not Clocked In" (no open shift found today), but when they click Clock In, the DB trigger blocks it because yesterday's shift is still open.

## Root Cause
`fetchEntries` filters `.gte("clock_in", todayStart.toISOString())` — any open shift from a previous day is invisible to the hook, so `activeEntry` is `null`, but the DB correctly rejects the new insert.

## Fix

### `src/hooks/useTimeClock.ts`
Two changes:

1. **`clockIn` — auto-close stale shifts before inserting**: Before attempting to insert a new clock-in, query for any open shift (`clock_out IS NULL`) for the current profile regardless of date. If one exists, auto-close it with `clock_out = now()` and a note `[auto-closed: stale shift]`, then proceed with the new clock-in.

2. **`activeEntry` — also check for any open shift across all dates**: Change the active entry detection to also fetch any open shift (not just today's), so the UI correctly shows "Clocked In" even if the shift started yesterday.

Specifically:

```ts
// In clockIn, before insert:
const { data: staleShifts } = await supabase
  .from("time_clock_entries")
  .select("id, clock_in")
  .eq("profile_id", myProfile.id)
  .is("clock_out", null);

if (staleShifts && staleShifts.length > 0) {
  // Auto-close all stale open shifts
  await supabase
    .from("time_clock_entries")
    .update({ 
      clock_out: new Date().toISOString(),
      notes: "[auto-closed: stale shift from previous session]"
    })
    .eq("profile_id", myProfile.id)
    .is("clock_out", null);
}
// Then proceed with insert
```

Also in `fetchEntries`, add a separate query for any open shift (no date filter) for the current user, and merge it into `entries` so `activeEntry` picks it up correctly.

Single file change, no migration needed.

