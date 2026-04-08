

# Enforce Date-Specific Data Filtering Across All User Sections

## Problem
When a date is selected, some data queries ignore it and show all-time data:
1. **`useUserAgentSessions`** — fetches all agent sessions regardless of date (no date parameter at all)
2. **`UserFullReportButton`** (line 521) — calls `useUserActivityLog(profile.id)` without passing `date`
3. **`UserAgentsSections`** (line 232) — calls `useUserAgentSessions(userId)` without date filtering

This means when you pick April 5th, the Agents section and report button still show all-time data.

## Changes

### 1. `src/hooks/useUserAgentSessions.ts` — Add date filtering

- Add optional `date?: Date` parameter
- Import `useWorkspaceSettings` and `getStartOfDayIsoInTimezone`
- Filter `chat_sessions` query with `.gte("updated_at", dayStart).lt("updated_at", dayEnd)` when date is provided
- Filter `chat_messages` total count query similarly
- Update `queryKey` to include date

### 2. `src/components/vizzy/VizzyBrainPanel.tsx` — Pass date everywhere

- **`UserAgentsSections`**: Add `date` prop, pass it to `useUserAgentSessions(userId, date)`
- **`UserFullReportButton`** (line 521): Pass `date` to `useUserActivityLog(profile.id, null, date)` and `useUserAgentSessions(profile.user_id, date)`
- **All call sites** of `UserAgentsSections`: Pass `date={userSelectedDate}`

### 3. Verify all other hooks already respect date

- `useUserPerformance` — already receives and uses `date` ✓
- `useUserActivityLog` — already supports `date` param ✓
- `useDetailedActivityReport` — already uses `date` ✓

| File | Change |
|------|--------|
| `src/hooks/useUserAgentSessions.ts` | Add optional `date` param with timezone-aware day boundary filtering |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Pass `date` to `UserAgentsSections`, fix `UserFullReportButton` to pass date to activity log and agent sessions |

