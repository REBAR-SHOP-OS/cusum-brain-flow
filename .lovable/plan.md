

# Rename "Activity Log" Section to "System Performance Overview"

## Goal
Give the Activity Log section (which shows user interactions across all system modules like Dashboard, Inbox, Team Hub, etc.) a more descriptive title that conveys overall system performance tracking.

## Change

### `src/components/vizzy/VizzyBrainPanel.tsx`
- **Line 1007-1008**: Change the section header icon and title:
  - Icon: Replace `Users` with `BarChart3` (or `Gauge`) to represent performance/metrics
  - Title: Change `"Activity Log"` to `"System Performance Overview"`
- **Line 1010-1011**: Update the `SectionReportButton` label accordingly

Single section header rename — no logic changes.

