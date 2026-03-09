

# Plan: Immediate Production Reset + Auto Clock-Out Cron Setup

## Current Production State
- **15 open shifts** (some going back 600+ hours — e.g., Ryle Lachini 619h, Kourosh Zand 409h, Zahra Zokaei 119h, Saurabh/Ben 72h+)
- **13 active profiles** all stuck as `is_active: true`
- **Zero auto-clockout cron jobs** exist in production — the function was deployed but never scheduled

## Root Cause
The `auto-clockout` edge function exists but no `cron.schedule()` jobs were ever created in production to call it. All previous attempts only modified the Test environment.

## Steps

### 1. Immediate Reset (Live SQL)
Run two UPDATE statements directly on **production** to close all 15 open shifts and deactivate all 13 profiles:

```sql
UPDATE time_clock_entries 
SET clock_out = NOW(), notes = '[auto-closed: manual reset]' 
WHERE clock_out IS NULL;

UPDATE profiles SET is_active = false WHERE is_active = true;
```

### 2. Create Two Cron Jobs (Live SQL)
Using the production anon key (already visible in existing cron jobs):

- **8 AM ET daily** (`0 12 * * *` UTC): `auto-clockout` with `{"mode": "morning"}` — closes all shifts, resets all profiles to inactive
- **5 PM ET daily** (`0 21 * * *` UTC): `auto-clockout` with `{"mode": "evening"}` — closes any remaining open shifts

### 3. No Code Changes Needed
The edge function already handles both modes correctly. No file modifications required.

## Expected Result
- All users immediately see themselves as "Not Clocked In"
- Every day at 8 AM ET: automatic full reset (clean slate)
- Every day at 5 PM ET: auto clock-out for anyone who forgot
- Users must manually clock in (or use Face ID kiosk) to appear active

