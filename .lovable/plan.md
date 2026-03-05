

# Fix: Kiosk Registration & Punch RLS + Speed Optimization

## Problem
The `ai@rebar.shop` user has `workshop` role, not `admin`. Current RLS policies on `profiles`, `face_enrollments`, and `time_clock_entries` only allow `admin` to INSERT profiles and only allow users to manage their OWN entries (matched by `user_id`). The kiosk creates profiles for OTHER people, so all client-side inserts fail with "new row violates row-level security policy".

## Root Cause
- `profiles` INSERT → only `admin` allowed
- `time_clock_entries` INSERT → only for profiles where `user_id = auth.uid()` (kiosk-created profiles have no user_id)
- `face_enrollments` INSERT → same restriction

## Solution: Two New Backend Functions

### 1. Create `kiosk-register` Edge Function
Uses service role to bypass RLS. Handles the full registration flow:
- Validates the caller has `workshop` or `admin` role
- Creates profile (with `company_id` from caller)
- Uploads face photo to `face-enrollments` storage bucket
- Inserts `face_enrollments` record
- Clocks in the new employee
- Returns `{ profile_id, name }`

### 2. Create `kiosk-punch` Edge Function
Uses service role for clock in/out by profile_id:
- Validates caller has `workshop` or `admin` role
- Checks if profile has open shift → clock out, else → clock in
- Handles auto-enrollment of face photo
- Returns `{ action: "clock_in" | "clock_out", profile_id }`

### 3. Update `FirstTimeRegistration.tsx`
Replace direct supabase calls with `supabase.functions.invoke("kiosk-register", { body: { name, faceBase64 } })`

### 4. Update `TimeClock.tsx` → `handleConfirmPunch`
When in kiosk mode, call `supabase.functions.invoke("kiosk-punch", { body: { profileId, faceBase64 } })` instead of direct DB calls.

### 5. Speed Optimization
- In `useFaceRecognition.ts`: reduce JPEG quality from 0.85 → 0.7 (smaller payload, faster upload)
- Auto-trigger scan on camera ready (no manual "Scan Face" click needed in kiosk mode)
- Reduce post-punch delay from 5s → 3s before next auto-scan

## Files to Create/Edit

| File | Action |
|---|---|
| `supabase/functions/kiosk-register/index.ts` | Create — service-role registration |
| `supabase/functions/kiosk-punch/index.ts` | Create — service-role punch |
| `src/components/timeclock/FirstTimeRegistration.tsx` | Edit — call edge function |
| `src/pages/TimeClock.tsx` | Edit — kiosk punch via edge function, faster auto-scan |
| `src/hooks/useFaceRecognition.ts` | Edit — lower JPEG quality for speed |

