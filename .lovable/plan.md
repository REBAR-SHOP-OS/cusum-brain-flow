

# Make Overview Report Comprehensive

## Problem
The clipboard icon next to each user in the "All" view opens an `OverviewReport` that only shows a basic monospace text with 3 sections: Attendance, Performance Summary, and Activity Breakdown (top 10 types). The user wants a truly comprehensive English report.

## Current State
The `OverviewReport` component (lines 322-431 in `SectionDetailReport.tsx`) builds a simple `<pre>` block with limited data. Meanwhile, the `ActivityReport` component in the same file already has rich visual sections (summary cards, event type breakdown, entity type breakdown, hourly timeline bar chart, full activity log with badges) — but is only shown for the "activity" sectionType, not for "overview".

## Plan

**File: `src/components/vizzy/SectionDetailReport.tsx`**

Rebuild the `OverviewReport` component to be a comprehensive visual report (not just monospace text) combining ALL available data:

1. **Keep the "Copy Report" button** — the monospace `buildFullReport()` text stays as the clipboard format, but gets expanded with all sections
2. **Replace the `<pre>` display** with a rich visual layout combining:
   - **Attendance Card** — Status badge (Clocked In / Off Clock), gross hours, detailed clock entries with durations
   - **Performance Summary Cards** — Activities, AI Sessions, Emails Sent, Hours (grid of 4 cards, same style as ActivityReport)
   - **Activity Breakdown by Event Type** — bar rows with counts (from `useDetailedActivityReport`)
   - **Activity Breakdown by Entity Type** — bar rows with counts
   - **Hourly Timeline** — horizontal bar chart showing activity distribution per hour
   - **Full Activity Log** — color-coded badges (Page/Email/AI/Action) with timestamps and descriptions, scrollable list showing ALL events (not just top 10)

3. **Expand `buildFullReport()` text** to include entity type breakdown, hourly timeline, and full log for the copy-to-clipboard version

4. **Keep `useEffect` for vizzy_memory persistence** — update it to save the expanded report text

This reuses the exact same visual patterns already proven in `ActivityReport` and `TimeClockReport` — just combined into one comprehensive view. No new hooks or data sources needed; `useUserPerformance` and `useDetailedActivityReport` are already imported and used.

## Files Modified
| File | Change |
|------|--------|
| `src/components/vizzy/SectionDetailReport.tsx` | Rebuild `OverviewReport` with comprehensive visual layout |

