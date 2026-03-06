

# Fix Stale Shifts & Enforce 8 AM–5 PM Clock-In Window

## Problem
1. Multiple @rebar.shop employees have **stale open shifts** (some 193+ hours!) showing as ACTIVE
2. The auto-clockout at 5 PM exists but clearly isn't catching everything
3. No restriction prevents clocking in before 8 AM ET

## Plan

### Step 1: Close All Stale Open Shifts Now
Run a direct SQL update to close all currently open shifts for @rebar.shop users (except kourosh@rebar.shop) with a cleanup note:

```sql
UPDATE time_clock_entries
SET clock_out = now(), notes = '[auto-closed: stale shift cleanup]'
WHERE clock_out IS NULL
AND profile_id IN (
  SELECT id FROM profiles WHERE email LIKE '%@rebar.shop' AND email != 'kourosh@rebar.shop'
);
```

Also close kiosk-created profiles (no email) with stale shifts (clock_in older than today).

### Step 2: Enforce 8 AM ET Clock-In Restriction
Add time validation in two places:

**A. Frontend (`useTimeClock.ts`)** — In the `clockIn` function, check if current Eastern Time is before 8:00 AM. If so, show a toast error "Clock-in is available from 8:00 AM" and block.

**B. Kiosk edge function (`kiosk-punch/index.ts`)** — Before allowing a clock-in action, check the current Eastern Time. If before 8 AM, return an error response.

**C. Database trigger (optional but recommended)** — Add a validation trigger on `time_clock_entries` INSERT that rejects clock-ins before 8 AM ET for @rebar.shop profiles, as a server-side safety net.

### Files to Change
1. **Database** — SQL to close all stale shifts immediately
2. **`src/hooks/useTimeClock.ts`** — Add 8 AM ET check in `clockIn()`
3. **`supabase/functions/kiosk-punch/index.ts`** — Add 8 AM ET check before clock-in
4. **Database migration** — Validation trigger to enforce 8 AM rule server-side

