

# Show Cumulative Daily Hours (Not Just Current Session)

## Problem
When a user is clocked in, the UI only shows the **current session** duration (e.g., "In since 10:33 AM · 23m"). It does not show cumulative hours from previous sessions that same day. If someone clocks out for a break and clocks back in, their earlier hours appear lost from the display.

The `totalMins` calculation already correctly sums all daily entries (including the current open session), but this value is only displayed when the user is clocked **out**. When clocked **in**, only the current session elapsed time is shown.

## Solution
Show cumulative daily total alongside the current session info when clocked in. Three locations need updating:

### 1. My Status Card (lines 432-436)
Currently: `since 10:33 AM · 23m`
After: `since 10:33 AM · 23m · Total today: 2h 29m`

Calculate `totalMins` from `entries` (all my daily entries) and display it when clocked in, alongside the current session elapsed.

### 2. Team Status Office Cards (line 239-241)
Currently when active: `In since 8:27 AM · 2h 29m`
After: `In since 8:27 AM · 2h 29m (Total: 4h 15m)` — only show total separately if there are multiple sessions

### 3. Kiosk Status Cards (lines 584-587)
Same logic as Team Status — show cumulative total when clocked in and there are previous sessions.

## Display Logic
- If clocked in with **only one session today**: show `In since X · elapsed` (no change, totalMins equals elapsed)
- If clocked in with **multiple sessions today**: show `In since X · elapsed · Total: Xh Ym`
- If clocked out with hours: show `Worked Xh Ym today` (already works correctly)

## Files Changed
- `src/pages/TimeClock.tsx` — update display in 3 locations to show cumulative daily total

