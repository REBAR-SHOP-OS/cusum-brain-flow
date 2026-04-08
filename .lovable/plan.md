

# Enhance Items Section with Full Comprehensive Report in "All" View

## Problem
The "Items" section in the "All" view currently only shows raw `vizzy_memory` entries grouped by category (Dashboard, Inbox, etc.). The user wants it to be the most comprehensive report possible, including summary statistics AND per-user breakdowns embedded within the Items view.

## Design
Add a **summary header card** at the top of the Items section and **per-user stats** within each category group, pulling data from both `vizzy_memory` and the `useTeamDailyPerformance` hook (which already provides activities, clock entries, AI sessions, and email counts per user).

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` — `renderContent()` function (lines 1355-1461)

**1. Add a summary stats banner inside the Items section header:**
- Total activities across all users
- Total hours worked
- Total AI sessions
- Total emails sent
- Total vizzy_memory entries
- Uses data from `useTeamDailyPerformance` (already available in parent scope via `TeamDailyReport`)

**2. Add per-user breakdown card inside each category group:**
- Before listing the vizzy_memory entries, show which users contributed to that category
- Show per-user: name, activity count in that category, clock in/out times, hours, AI sessions

**3. Implementation approach:**
- Create a new `ItemsSummaryHeader` component that receives team performance data and displays aggregate stats
- Modify `renderContent()` to accept and display team-wide data when `!selectedProfile` (All view)
- Add a `useTeamDailyPerformance` call inside `VizzyBrainPanel` (or lift the existing one from `TeamDailyReport`) so the data is available to the Items section
- Each category accordion will show a compact per-user row above the memory entries

**4. Data flow:**
- `useTeamDailyPerformance` → provides per-user activities, hours, clockEntries, aiSessions, emailsSent
- Cross-reference with `vizzy_memory` entries to show which users appear in each category
- Summary stats are aggregated from the team performance data

### Visual structure:
```text
┌─ Items ─────────────────────────────────────┐
│ 📊 Summary: 245 activities | 38.2h total    │
│             12 AI sessions | 31 emails      │
├─────────────────────────────────────────────┤
│ ▸ 📊 Dashboard (26)                         │
│   Users: Sattar(8) Saurabh(6) Behnam(5)... │
│   [memory entries...]                        │
│ ▸ 📥 Inbox (15)                             │
│   Users: Radin(5) Sattar(4)...              │
│   [memory entries...]                        │
└─────────────────────────────────────────────┘
```

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Add summary stats banner + per-user breakdown in Items section for "All" view |

