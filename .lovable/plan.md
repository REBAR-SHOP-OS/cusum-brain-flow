

# Add Calendar Date Picker to Team Daily Report

## Goal
Add a calendar icon to the Team Daily Report header that opens an inline date picker, allowing the user to navigate to any day's team activity report (not just today).

## Changes

### 1. Update `useTeamDailyActivity.ts`
- Add optional `date` parameter (defaults to today)
- Pass it to `getStartOfDayIsoInTimezone(timezone, date)` and compute end-of-day for bounded queries
- Include `date` in the `queryKey` so React Query refetches on date change

### 2. Update `TeamDailyReport` in `VizzyBrainPanel.tsx`
- Add local `selectedDate` state (defaults to today)
- Add a `CalendarIcon` button next to the report header (beside the existing clipboard button)
- Clicking it toggles an inline `Calendar` component (from `@/components/ui/calendar`) in a small popover/dropdown below the header
- On date select, update `selectedDate` and pass it to `useTeamDailyActivity`
- Show the selected date as a label (e.g., "Apr 7, 2026") next to "Team Daily Report" when not today
- Show a "Today" badge/button to quickly reset back to current day

## File Summary

| File | Change |
|------|--------|
| `src/hooks/useTeamDailyActivity.ts` | Accept optional `date` param, use it in query boundaries and queryKey |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add calendar icon + date picker + date state to `TeamDailyReport` |

## Technical Notes
- Reuses existing `Calendar` component and `Popover` from shadcn/ui
- `getStartOfDayIsoInTimezone` already accepts a `date` parameter — no new utility needed
- End-of-day boundary computed by adding 1 day to start, using `.lt("created_at", nextDayStart)` filter
- No database changes needed

