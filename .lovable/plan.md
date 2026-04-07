

# "All" Tab: Daily Team Activity Report

## Goal
When "All" is selected (no specific user), show a comprehensive daily report of **all @rebar.shop users' actions** in collapsible accordion sections — one section per user — with report icons on each. Currently "All" only shows Vizzy memory entries by category; this adds a team activity summary above it.

## Design

```text
┌─────────────────────────────────────┐
│ All  [A] Ai  [B] Behnam  [K] ...   │
├─────────────────────────────────────┤
│ 👥 Team Daily Report                │
│                                     │
│ ▸ Behnam (12 activities) 📋        │
│   Clock: 8:12 AM → Still working    │
│   • page_visit — Visited Orders     │
│   • lead_update — Updated lead ...  │
│                                     │
│ ▸ Kourosh (8 activities) 📋        │
│   Clock: 9:00 AM → 5:30 PM         │
│   • email_sent — Sent email to ...  │
│                                     │
│ ▸ Radin (3 activities) 📋          │
│   Not clocked in today              │
│   • page_visit — Visited Home       │
├─────────────────────────────────────┤
│ 📊 Dashboard (37)        ▸         │
│ 📥 Inbox (3)             ▸         │
│ ...existing memory sections...      │
└─────────────────────────────────────┘
```

## Changes

### 1. New hook: `src/hooks/useTeamDailyActivity.ts`
- Accepts array of profile IDs
- Fetches `activity_events` for all @rebar.shop users today in a single query (using `.in("actor_id", profileIds)`)
- Also fetches `time_clock_entries` for all users today
- Returns grouped data: `Record<profileId, { activities: ActivityEvent[], clockEntries: ClockEntry[] }>`

### 2. Update `VizzyBrainPanel.tsx`
- Add a new `TeamDailyReport` component rendered when `!selectedProfile`
- Shows one accordion item per @rebar.shop user (sorted by activity count descending)
- Each accordion section contains:
  - Clock-in/out summary (first/last entry)
  - Activity list (same format as `UserActivitySection`)
- Each section header has the `SectionReportButton` for clipboard export
- Rendered **above** the existing memory category accordions

### File Summary

| File | Change |
|------|--------|
| `src/hooks/useTeamDailyActivity.ts` | New hook — batch fetch activities + clock entries for all team members |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add `TeamDailyReport` component, render above memory sections when "All" selected |

## Technical Notes
- Single query with `.in()` filter instead of N+1 queries per user
- Reuses existing `formatDateInTimezone` and `SectionReportButton`
- No database changes needed

