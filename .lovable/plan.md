

# Plan: Immediate Reset + Production Cron Setup

## Current State (Production)
- **15 open shifts** still showing as clocked in
- **13 active profiles** still marked active
- **No auto-clockout cron jobs exist** — only `timeclock-missed-clockin/clockout` alert jobs exist (jobid 11, 12)

## Steps

### 1. Immediate SQL Reset on Production
Run SQL directly on production to close all open shifts and deactivate all profiles right now:
```sql
UPDATE time_clock_entries SET clock_out = NOW(), notes = '[auto-closed: 8 AM morning reset]' WHERE clock_out IS NULL;
UPDATE profiles SET is_active = false WHERE is_active = true;
```

### 2. Create Two Auto Clock-Out Cron Jobs on Production
Using the production anon key from existing cron jobs:

- **8 AM ET daily** (`0 12 * * *` UTC): Calls `auto-clockout` with `{"mode": "morning"}` — closes ALL open shifts, sets all profiles inactive
- **5 PM ET weekdays** (`0 22 * * 1-5` UTC): Calls `auto-clockout` with `{"mode": "evening"}` — closes all remaining open shifts

### 3. Update Evening Mode
Change the evening mode to also close **all** users (not just `@rebar.shop`), since the rule applies to everyone.

### Result
- Right now: all users immediately clocked out
- Every day at 8 AM ET: automatic full reset
- Every weekday at 5 PM ET: auto clock-out for anyone who forgot
- Users must manually clock in or use face scan to appear active

