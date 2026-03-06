

# Kiosk Status Tab: Use Same Logic as Team Status

## What
Replace the current Kiosk Status tab content (which only shows clocked-in profiles) with the exact same layout and logic as Team Status — showing ALL employees with their status (Active/Off/worked duration), not just present ones. The Farsi text will also be changed to English.

## Changes

### File: `src/pages/TimeClock.tsx` — Lines 444-493

Replace the entire `TabsContent value="kiosk-status"` block to reuse the same rendering logic as the Team Status tab (lines 369-414):

- Show **all** `activeProfiles` (not just clocked-in)
- Same card layout: avatar with green/gray indicator, name, clock-in time or worked duration, Active/Off badge
- Change header text from Farsi to English: "{count} people present" 
- Change "حاضر" badge to "Active", empty state to English

