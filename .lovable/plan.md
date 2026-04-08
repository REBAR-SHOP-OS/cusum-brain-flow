

# Pass Selected Date to Activity Log in Vizzy Brain

## Problem
When selecting a date via the calendar in the General Overview section, `PerformanceCard` and `UserTimeClockSection` update correctly (they accept `date`), but the **System Performance Overview** (activity log) always shows today's data regardless of the selected date.

## Changes

### 1. `src/hooks/useUserActivityLog.ts`
- Add optional `date?: Date` parameter
- Use it to compute day boundaries (start and end) instead of always using today
- Include `date` in the `queryKey` so it refetches on date change

### 2. `src/components/vizzy/VizzyBrainPanel.tsx`
- `UserActivitySection`: Add `date` prop, pass it to `useUserActivityLog`
- Where `<UserActivitySection>` is rendered (line 1448): pass `date={userSelectedDate}`

| File | Change |
|------|--------|
| `useUserActivityLog.ts` | Accept `date` param, compute day boundaries, add to queryKey |
| `VizzyBrainPanel.tsx` | Pass `date` through `UserActivitySection` to the hook |

Two files, minimal changes.

