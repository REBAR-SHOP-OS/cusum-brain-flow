

# Enhance System Performance Overview with Detailed User Actions

## Problem
The System Performance Overview currently shows only raw technical labels (`page_visit · page`) without meaningful context. The user wants to see a comprehensive view of what each person actually did — not just page visits, but all actions with human-readable descriptions, grouped intelligently.

## Changes

### 1. Enhance `UserActivitySection` in `VizzyBrainPanel.tsx`

Currently shows a flat list of raw events. Redesign to show:

**Summary bar at top:**
- Total actions count, pages visited, emails sent/deleted, mutations, AI sessions — as compact badges

**Grouped display by category** (instead of flat chronological):
- Pages Visited (grouped/deduplicated with visit counts)
- Emails (sent, deleted, archived — with subject/recipient from description)
- Data Mutations (lead updates, order changes, barlist actions)
- AI & Agent Interactions
- Other actions

Each group is collapsible, showing count in header. Within each group, items are chronological with timestamps.

**Human-readable labels** via a mapping function:
- `page_visit` → "Visited [page name]"
- `email_sent` → "Sent email"
- `email_deleted` → "Deleted email"
- `barlist_approved` → "Approved barlist"
- `machine_run_started` → "Started machine run"
- etc.

### 2. Enhance `SectionDetailReport.tsx` — Activity Report

The detailed report dialog already has breakdowns, but enhance it with:
- Human-readable event labels (same mapping)
- Richer full log with color-coded category badges (page=blue, email=green, mutation=orange, AI=purple)
- Description always visible (not truncated)

### 3. Update `useUserActivityLog.ts`

- Include `metadata` field in the select query so we can extract richer details (page path, email subject, etc.)
- Increase default limit from 50 to 200 for better day coverage

### 4. Update `useDetailedActivityReport.ts`

- Also select `metadata` field for richer report content

## Technical Details

| File | Change |
|------|--------|
| `useUserActivityLog.ts` | Add `metadata` to select, increase limit to 200 |
| `useDetailedActivityReport.ts` | Add `metadata` to select |
| `VizzyBrainPanel.tsx` (`UserActivitySection`) | Redesign with summary badges + grouped categories + human-readable labels |
| `SectionDetailReport.tsx` | Enhance ActivityReport with color-coded badges and readable labels |

