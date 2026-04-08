

# Per-User Report Dialog in Team Daily Report + Vizzy Memory

## Problem
The clipboard icon next to each user in the Team Daily Report currently opens only the "activity" report (just activity events). The user wants a **comprehensive per-user report** (activities + hours + AI + emails + clock entries + breakdown) shown in a dialog, and all per-user reports should also be saved to Vizzy memory.

## Changes

### 1. `SectionDetailReport.tsx` — Change per-user report to use "overview" type
The `sectionType="activity"` on each per-user icon (line 1059-1066 in VizzyBrainPanel) will be changed to `sectionType="overview"`, which already shows the full report (status, hours, activities, AI sessions, emails, clock entries, activity breakdown).

### 2. `SectionDetailReport.tsx` — Auto-save per-user report to `vizzy_memory`
Add a `useEffect` in `OverviewReport` that saves the report text to `vizzy_memory` with category `user_daily_report_{userId}` when the dialog opens, so Vizzy always has access to each user's report.

### 3. `VizzyBrainPanel.tsx` — Update the per-user icon
Change `sectionType="activity"` → `sectionType="overview"` for the per-user clipboard icon in the TeamDailyReport accordion.

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Change per-user `sectionType` from `"activity"` to `"overview"` |
| `SectionDetailReport.tsx` | Add vizzy_memory save in `OverviewReport` for per-user reports |

