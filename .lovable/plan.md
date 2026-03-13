

# Fix: Clock-In Failing with "Failed to clock in" Error

## Problem

The user (Radin Lachini, radin@rebar.shop) gets "Failed to clock in" at 7:57 AM. The 6 AM time restriction in `useTimeClock.ts` (line 120: `getHours() < 6`) is already correct — it would NOT block at 7:57 AM. The toast "Failed to clock in" comes from lines 148 or 165, meaning the actual database INSERT is failing.

The most likely cause: the `.insert().select().single()` chain fails because Supabase RLS evaluates the SELECT step separately. Although the admin ALL policy exists with a `qual` condition, the `select().single()` after insert requires the row to be visible — and if there's an RLS evaluation hiccup (e.g., `get_user_company_id` fails, stale session), the entire operation errors out.

## Fix Plan

### 1. Make clock-in INSERT more resilient (`src/hooks/useTimeClock.ts`)
- Remove `.select().single()` from the INSERT call — just do `.insert()` without chaining select
- After successful insert, call `fetchEntries()` to get the entry via the SELECT policy (which is separate and more lenient)
- Add detailed error logging with the actual error message/code to the toast so we can diagnose any future issues
- Add a console.log of `myProfile.id` and auth state before the insert for debugging

### 2. Add radin@rebar.shop to CLOCK_EXEMPT list
- The user is admin and should not be subject to time restrictions
- Add to both `useTimeClock.ts` (line 116) and `kiosk-punch/index.ts` (line 64)

### 3. Improve error messages
- Change generic "Failed to clock in" to include the actual error: `"Failed to clock in: " + error.message`
- This ensures future failures are immediately diagnosable

### Files to Edit
- `src/hooks/useTimeClock.ts` — resilient insert, exempt list, better error messages
- `supabase/functions/kiosk-punch/index.ts` — exempt list sync

