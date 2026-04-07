

# Add Calendar Date Picker to Individual User View

## Goal
Add a calendar icon to the individual user's "General Overview" section header, allowing navigation to any day's performance data — matching the same pattern already used in the "All" tab's Team Daily Report.

## Changes

### 1. Update `useUserPerformance.ts`
- Add optional `date?: Date` parameter
- Compute `dayStart` and `dayEnd` using `getStartOfDayIsoInTimezone(timezone, date)` (same pattern as `useTeamDailyActivity`)
- Add `.lt("created_at", dayEnd)` / `.lt("clock_in", dayEnd)` upper bound filters
- Include date in `queryKey` for reactive refetch

### 2. Update `VizzyBrainPanel.tsx` — individual user view
- Add `selectedDate` state and `calendarOpen` state at the user view level (inside the `selectedProfile` block)
- Add `CalendarIcon` button + `Popover` with `Calendar` in the "General Overview" section header (next to the existing `SectionReportButton`)
- Show date label when not today, plus a "Today" reset button
- Pass `selectedDate` to `PerformanceCard` → `useUserPerformance`
- Add `pointer-events-auto` to Calendar className and `z-[100001]` to PopoverContent (same fix as Team report)

### 3. Update `PerformanceCard` component
- Accept optional `date?: Date` prop
- Pass it through to `useUserPerformance(profileId, userId, date)`

## File Summary

| File | Change |
|------|--------|
| `src/hooks/useUserPerformance.ts` | Add `date` param, bounded queries, date in queryKey |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add calendar UI to individual user view, pass date to PerformanceCard |

