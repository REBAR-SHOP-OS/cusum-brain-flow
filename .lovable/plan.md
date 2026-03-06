

# Kiosk Status: Show Only Kiosk-Scanned Attendance

## Problem
Currently, the Kiosk Status tab mirrors Team Status and shows all employees. The user wants it to only show people whose attendance was registered through the kiosk face scan (by ai@rebar.shop), not manual clock-ins.

## Solution
Add a `source` column to `time_clock_entries` to distinguish kiosk punches from manual ones, then filter the Kiosk Status tab accordingly.

## Changes

### 1. Database Migration
Add a `source` column to `time_clock_entries`:
```sql
ALTER TABLE public.time_clock_entries 
ADD COLUMN source text DEFAULT 'manual';
```

### 2. Edge Functions — Mark kiosk punches
**`supabase/functions/kiosk-punch/index.ts`**: Set `source: 'kiosk'` on clock-in insert.

**`supabase/functions/kiosk-register/index.ts`**: Set `source: 'kiosk'` on the initial clock-in insert.

### 3. Frontend — `src/hooks/useTimeClock.ts`
No changes needed — `allEntries` already fetches all entries including the new `source` field.

### 4. Frontend — `src/pages/TimeClock.tsx`
Update the Kiosk Status `TabsContent` to filter `allEntries` where `source === 'kiosk'` for today, then display only profiles that have a kiosk punch today with their status (Active/Off), clock-in time, and duration.

