

# Make Team Daily Report Show All Users & Open Detailed Reports on Click

## Current State
- The Team Daily Report already shows all @rebar.shop users (including inactive ones like Sattar and Vicky, shown with reduced opacity).
- Each user row has a small clipboard icon that opens a detailed "Overview" report dialog.
- Clicking the user row itself only expands/collapses an accordion with raw activity items — not a detailed report.

## What Will Change

### 1. Make User Rows Clickable to Open Detailed Report
Instead of just expanding an accordion with raw activity logs, clicking on a user row in the Team Daily Report will open the full **Overview Report Dialog** (`SectionDetailReportDialog` with `sectionType="overview"`). This provides the rich, categorized report with attendance, performance breakdown, activity timeline, and action log — exactly like the one the clipboard icon already opens.

### 2. Keep All Users Visible
All @rebar.shop profiles are already shown (including inactive ones). No change needed here — confirmed both in code and database.

## Technical Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` — `TeamDailyReport` component (lines 1239–1337)

- Replace the `Accordion`/`AccordionItem`/`AccordionTrigger` pattern with simple clickable cards
- Each card click opens a `SectionDetailReportDialog` with `sectionType="overview"` for that user
- Use a controlled `Dialog` state (tracked by `openProfileId`) instead of accordion expand
- Keep the same visual layout: avatar circle, name, activity count, hours, AI sessions, emails badges
- The small clipboard icon per row can be removed since the whole row now triggers the report

### Result
- Clicking anywhere on a user row opens the full detailed report dialog for that user
- All rebar.shop users remain visible (active and inactive)
- The same rich Overview Report that the clipboard icon opened is now accessible by clicking the row itself

