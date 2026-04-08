

# Transform Section Report Button into Full Detailed Report Modal

## Problem
The clipboard icon (`SectionReportButton`) currently only copies a short text to clipboard. The user wants it to open a full, comprehensive report page/modal for that section.

## Approach
Replace `SectionReportButton` with a new `SectionDetailReportDialog` component that opens a dialog/sheet with a rich, detailed report for each section.

## Changes

### 1. Create `src/components/vizzy/SectionDetailReport.tsx`
A new dialog component that:
- Accepts `sectionType` (`"activity"` | `"timeclock"` | `"overview"` | `"team"`)
- Accepts the relevant data props (profileId, userId, date, timezone)
- Opens a large dialog/sheet with a comprehensive report including:
  - **Activity section**: Full list of all activities (no 50-item limit), grouped by event_type, with counts per category, timeline visualization, and summary stats
  - **Time Clock section**: All clock entries with total hours, break analysis, shift patterns, overtime detection
  - **Overview section**: Full performance card data, all metrics expanded with charts
  - **Team section**: All team members' summary for the day
- Includes a "Copy Report" and "Download PDF" button in the dialog header

### 2. Update `src/components/vizzy/VizzyBrainPanel.tsx`
- Replace `SectionReportButton` with the new `SectionDetailReportDialog` trigger button (same icon, same position)
- Pass appropriate data props to each instance
- Keep the clipboard icon (`ClipboardList`) as the trigger

### 3. Create `src/hooks/useDetailedActivityReport.ts`
- A new hook that fetches ALL activities for a user on a given date (no limit of 50)
- Groups activities by `event_type` and `entity_type`
- Computes summary statistics (total actions, most active hour, breakdown by category)

## Report Content Per Section

**System Performance Overview report:**
- Total actions count
- Breakdown by event type (page_visit, email_sent, lead_updated, etc.) with counts
- Breakdown by entity type
- Timeline: actions grouped by hour
- Most visited pages list
- Full chronological activity log (all entries, not just 50)

**Time Clock report:**
- All shifts with start/end/duration/breaks
- Total gross hours, net hours, break time
- Overtime calculation (>8h)
- Shift pattern summary

## Technical Details
- Use `Dialog` from shadcn for the modal (large size, scrollable)
- Fetch data using a separate query with higher limit (500+)
- Group and aggregate data client-side
- Reuse existing `formatDateInTimezone` utility

| File | Change |
|------|--------|
| `SectionDetailReport.tsx` | New component — full report dialog |
| `useDetailedActivityReport.ts` | New hook — fetch & aggregate all activities |
| `VizzyBrainPanel.tsx` | Replace `SectionReportButton` with new dialog trigger |

