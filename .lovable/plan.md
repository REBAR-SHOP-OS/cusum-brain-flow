

# Plan: Add Admin Clock-Out Button for Other Users

## What
Add a "Clock Out" button on each team member's card in the Team Status tabs, visible only to admin users. Clicking it will close that user's open shift and set their profile to inactive.

## How

### 1. Add `adminClockOut` function to `useTimeClock.ts`
- New async function that takes a `profileId` parameter
- Closes all open `time_clock_entries` for that profile (`UPDATE ... SET clock_out = NOW() WHERE profile_id = X AND clock_out IS NULL`)
- Sets `profiles.is_active = false` for that profile
- Calls `fetchEntries()` to refresh

### 2. Update `TimeClock.tsx` — `renderProfileCard`
- Import `useSuperAdmin` (already available) or use existing `isAdmin` from `useUserRole`
- For clocked-in users, show a small "Clock Out" button (LogOut icon) next to the Active badge — only when `isAdmin` is true
- On click, call `adminClockOut(profile.id)` with a confirmation dialog
- Reuse existing `ConfirmActionDialog` component

### 3. Wire up state
- Add `adminClockOut` to the return of `useTimeClock`
- Add a `clockOutTarget` state in `TimeClock.tsx` for the confirmation dialog

### Files Changed
- `src/hooks/useTimeClock.ts` — add `adminClockOut` function
- `src/pages/TimeClock.tsx` — add clock-out button to profile cards + confirmation dialog

