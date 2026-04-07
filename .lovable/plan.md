

# Auto Clock-Out All Team Members at 5:00 PM ET Daily

## Current State
- A cron job exists (jobid 22) that calls `auto-clockout` with `mode: "evening"` at **10 PM UTC (6 PM ET)**, Mon-Fri
- The evening mode only closes shifts open **>12 hours** — it does NOT close all open entries
- **Result**: Members who clocked in at e.g. 8 AM are only ~10h in, so they are skipped

## Root Cause
There is no "force close all" mode. The existing logic requires shifts to exceed a duration threshold before closing them.

## Plan

### 1. Add `"end_of_day"` mode to `auto-clockout` edge function
**File**: `supabase/functions/auto-clockout/index.ts`

- Accept `"end_of_day"` as a valid mode alongside `"morning"` and `"evening"`
- In `end_of_day` mode: close **ALL** open `clock_entries` regardless of how long they've been open
- Set `clock_out` to exactly 5:00 PM ET (17:00 America/New_York → convert to UTC)
- Calculate `total_hours` and `break_minutes` normally
- Tag notes as `Auto clock-out (end_of_day sweep)`

### 2. Schedule new cron job at 5:00 PM ET (21:00 UTC)
**Via**: Supabase SQL insert (not migration — contains project-specific secrets)

```sql
SELECT cron.schedule(
  'auto-clockout-5pm',
  '0 21 * * *',  -- 21:00 UTC = 5:00 PM ET, every day
  $$ ... body: {"mode": "end_of_day"} $$
);
```

Runs **every day** (including weekends, to catch any weekend shifts).

### 3. Optionally update or remove the old 10 PM UTC job
The old evening job (jobid 22) at 10 PM UTC becomes redundant since the 5 PM ET job will have already closed everything. We can either:
- Remove it (`cron.unschedule(22)`)
- Or keep it as a safety net (it will find 0 open entries and do nothing)

I recommend **keeping it** as a fallback — zero cost if nothing is open.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/auto-clockout/index.ts` | Add `"end_of_day"` mode (~15 lines) |
| SQL (insert, not migration) | New cron job at 21:00 UTC daily |

## Impact
- Every day at exactly 5:00 PM ET, all open shifts are automatically closed
- `clock_out` timestamp is set to 5:00 PM ET precisely
- Hours and breaks calculated normally
- Activity events and automation runs logged as usual
- No UI or database schema changes needed

