

# Enhance Vizzy Brain User Performance Panel

## Goal
When a @rebar.shop user is selected in the Vizzy Brain panel, show three comprehensive sections with report icons:
1. **General Overview** — performance stats + detailed clock-in/clock-out entries
2. **Agents** — all agents the user has access to (from `userAgentMap` + session history)
3. **Activity Log** — all actions the user performed today (from `activity_events`)
4. **Time Clock** — detailed clock-in/clock-out entries with timestamps

Each collapsible section gets a small report/download icon button that generates a summary.

## Changes

### 1. New hook: `src/hooks/useUserActivityLog.ts`
- Query `activity_events` for the selected user's `actor_id` today
- Return list of events: `event_type`, `entity_type`, `description`, `created_at`
- Ordered by `created_at` descending, limit 50

### 2. Expand `useUserPerformance.ts`
- Return the full `clockEntries` array (clock_in, clock_out) instead of just summary stats
- This provides the detailed clock-in/clock-out times the user wants

### 3. Update `VizzyBrainPanel.tsx`

**New Section: Activity Log**
- Add an "Activities" accordion section (between Agents and Time Clock)
- Show each activity event with icon, description, and timestamp
- Grouped by event_type for readability

**Enhanced Time Clock Section**
- Currently shows only "In: 8:12 AM" and "Hours: 2.5h" in the overview card
- Add a dedicated "Time Clock" accordion showing each entry:
  - Clock In time (formatted in timezone)
  - Clock Out time (or "Still working" badge)
  - Duration for that entry

**Report Icon on Each Section Header**
- Add a `FileText` (or `ClipboardList`) icon button next to each section title
- On click: copies a text summary of that section to clipboard (toast confirmation)
- Covers: General Overview, Agents, Activities, Time Clock

### 4. File Summary

| File | Change |
|------|--------|
| `src/hooks/useUserActivityLog.ts` | New hook — fetch activity_events for user today |
| `src/hooks/useUserPerformance.ts` | Return full `clockEntries` array alongside summary |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add Activity Log section, enhanced Time Clock section, report icons on all section headers |

## Technical Notes
- Activity events are queried by `actor_id` (profile ID) from `activity_events` table
- Clock entries already fetched in `useUserPerformance` — just need to expose the raw array
- Report icon uses clipboard API (`navigator.clipboard.writeText`) with toast feedback
- No database or migration changes needed

