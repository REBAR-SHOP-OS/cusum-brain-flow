

# Plan: Auto Clock-Out at 8 AM Daily + Clean Morning State

## Problem
Users who were clocked in yesterday still show as "ACTIVE / Clocked In" the next morning. Everyone should start fresh at 8 AM ET daily, and only appear clocked in after they manually clock in or use face scan.

## Current State
- **Existing cron** (`jobid:6`): Runs at 5 PM ET weekdays — closes only `@rebar.shop` office users
- This does NOT close shop/kiosk workers, so they remain "clocked in" overnight

## Solution

### 1. Update `auto-clockout` Edge Function
Add a `mode` parameter:
- `mode: "morning"` (default) → Close **ALL** open shifts for everyone, set all profiles inactive
- `mode: "evening"` → Existing behavior (only `@rebar.shop` office users, except kourosh)

**File:** `supabase/functions/auto-clockout/index.ts`

### 2. Add New Cron Job for 8 AM ET Daily
Schedule a new `pg_cron` job that calls the edge function with `mode: "morning"` every day at 8 AM ET.
- 8 AM EDT = 12:00 UTC, 8 AM EST = 13:00 UTC
- Schedule at both `0 12,13 * * *` and have the function verify current ET hour is 8 before acting (to handle DST transitions cleanly)

### 3. Keep Existing 5 PM Cron
The existing weekday 5 PM job continues to close office users mid-day. It will pass `mode: "evening"`.

### Changes Summary
- **Edit:** `supabase/functions/auto-clockout/index.ts` — add `mode` parameter support, "morning" mode closes all shifts
- **SQL:** New cron job for daily 8 AM ET execution
- **SQL:** Update existing 5 PM cron to pass `mode: "evening"` in the body

