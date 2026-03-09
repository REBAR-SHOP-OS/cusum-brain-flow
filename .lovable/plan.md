

# Plan: Reset All Open Shifts + Setup Auto Clock-Out Cron Jobs on Production

## Current Problem
- **14 open shifts** and **13 active profiles** in production right now
- No `auto-clockout` cron jobs exist in production
- The edge function was written but never deployed to production

## Steps

### 1. Immediate Reset via SQL (Production)
Run direct SQL on production to close all 14 open shifts and set all profiles to inactive:
```sql
UPDATE time_clock_entries SET clock_out = NOW(), notes = '[auto-closed: 8 AM morning reset]' WHERE clock_out IS NULL;
UPDATE profiles SET is_active = false WHERE is_active = true;
```
This gives an instant clean state without waiting for the edge function.

### 2. Remove Hour Guard from Edge Function
The current morning mode has a guard that skips if current ET hour is not 7-9. This prevents manual triggers. Change it to only log a warning but still execute, so cron and manual calls both work.

### 3. Deploy Edge Function
Deploy `auto-clockout` to production so cron jobs can call it.

### 4. Create Two Cron Jobs on Production
- **8 AM ET daily** (`0 12,13 * * *` UTC): Calls `auto-clockout` with `{"mode": "morning"}` -- closes ALL open shifts, sets all profiles inactive
- **5 PM ET weekdays** (`0 21,22 * * 1-5` UTC): Calls `auto-clockout` with `{"mode": "evening"}` -- closes @rebar.shop office users

Both jobs will use the production Supabase URL (`uavzziigfnqpfdkczbdo`) and anon key matching existing cron jobs.

## Result
- Every morning at 8 AM ET: all users start fresh (clocked out)
- Users must manually clock in or use face scan
- If they forget to clock out, system auto-closes at 5 PM ET

