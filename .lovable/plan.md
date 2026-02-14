
# Fix Attendance Alerts for Friday-Only Working Hours

## Problem
The attendance alert system currently fires every weekday (Monday-Friday) at 9:30 AM and 6:30 PM. Since your working hours are **Friday only, 8 AM - 5 PM**, you're getting false "nobody signed in" alerts Monday through Thursday when no one is expected to work.

## What Will Change

### 1. Update Cron Schedules (Database)
Change both cron jobs to run **only on Fridays**:
- Missed clock-in alert: Friday at 8:30 AM (30 minutes after your 8 AM start)
- Missed clock-out alert: Friday at 5:30 PM (30 minutes after your 5 PM end)

### 2. Add Day-of-Week Safety Check (Edge Function)
Add a guard inside the `timeclock-alerts` function so that even if the cron fires on the wrong day, it exits early without creating alerts. This acts as a safety net.

## Technical Details

### Database Migration
Update cron jobs 11 and 12:
- Job 11: Change schedule from `30 9 * * 1-5` to `30 8 * * 5` (Friday 8:30 AM UTC)
- Job 12: Change schedule from `30 18 * * 1-5` to `30 17 * * 5` (Friday 5:30 PM UTC)

### Edge Function Change (`supabase/functions/timeclock-alerts/index.ts`)
Add a working-day check near the top of the function:
- Get the current day of the week
- If it is not Friday (day 5), return early with a message "Not a working day"
- This prevents false alerts even if the cron schedule is accidentally changed

### Files to Modify

| Action | Target |
|--------|--------|
| Database migration | Update cron job schedules (jobs 11, 12) |
| Modify | `supabase/functions/timeclock-alerts/index.ts` -- add Friday-only guard |
