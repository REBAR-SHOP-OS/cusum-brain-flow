

# Fix: Team Status Not Reflecting Open Shifts & Clock Out Working For All Users

## Problem
Two issues visible in the screenshot:

1. **"Radin Lachini" shows as "Not clocked in" / "OFF" in Team Status** despite being actively clocked in (shown at the top with 311h). This is because `allEntries` only fetches **today's** entries, but the open shift started days ago.

2. The Clock Out button works correctly for the logged-in user (uses `activeEntry` from merged data), but the **Team Status grid** uses `allEntries` which misses stale open shifts from other days — so other team members with old open shifts also appear incorrectly as "Off".

## Fix

### `src/hooks/useTimeClock.ts`
Update `fetchEntries` to also fetch **all open shifts across all dates for all profiles** (not just the current user), and merge them into `allEntries`:

1. After fetching today's entries, run a second query: all entries where `clock_out IS NULL` (no date filter, no profile filter)
2. Merge those into `allEntries` (deduplicating by ID)
3. This ensures the `statusMap` in `TimeClock.tsx` correctly detects open shifts from previous days for every team member

```ts
// After fetching today's entries:
const { data: allOpenShifts } = await supabase
  .from("time_clock_entries")
  .select("*")
  .is("clock_out", null);

// Merge: today's entries + any open shift not already included
const todayIds = new Set((data || []).map(e => e.id));
const extraOpen = (allOpenShifts || []).filter(e => !todayIds.has(e.id));
setAllEntries([...extraOpen, ...(data || [])] as TimeClockEntry[]);
```

Single file change, no migration needed. This ensures every team member's open shift is visible in Team Status regardless of when they clocked in.

