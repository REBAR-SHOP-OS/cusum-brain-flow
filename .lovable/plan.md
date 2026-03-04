

# Auto Clock-Out at 5 PM for @rebar.shop Users (Except Kourosh Zand)

## What This Does
Creates a scheduled backend function that runs every day at 5 PM (Eastern Time) and automatically clocks out all @rebar.shop employees who are still clocked in — except Kourosh Zand, who works flexible shop hours.

## Implementation

### 1. Edge Function: `supabase/functions/auto-clockout/index.ts`
- Query all open shifts (`clock_out IS NULL`) joined with `profiles` table
- Filter to profiles with `email LIKE '%@rebar.shop'` AND `email != 'kourosh@rebar.shop'`
- Update matching entries: set `clock_out = 5:00 PM today (ET)` and `notes = '[auto-closed: 5 PM auto clock-out]'`
- Return count of closed shifts

### 2. Cron Job (SQL via insert tool)
- Schedule `pg_cron` job to call the edge function at `0 21 * * 1-5` (9 PM UTC = 5 PM ET, weekdays only)
- Uses `pg_net.http_post` to invoke the function
- Extensions `pg_cron` and `pg_net` are already enabled

### 3. No UI Changes Needed
The existing `useTimeClock` hook already handles realtime updates — when shifts are closed by the backend, the UI will reflect the change automatically.

## Technical Details
- Time zone: 5 PM Eastern = 9 PM UTC (adjusts for DST manually if needed, but cron uses fixed UTC)
- Kourosh's email in profiles: `kourosh@rebar.shop`
- The function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

