

# Fix Clipboard Icon: Always Persist Reports + Fix Click-to-Open

## Problem
1. The clipboard icon next to each user in the Team Daily Report does nothing when clicked — the dialog doesn't open.
2. The report data is only saved to `vizzy_memory` when the dialog is manually opened, meaning Vizzy's voice assistant has no access to it unless someone clicks it first.

## Root Cause
- The `SectionDetailReportDialog` renders an `OverviewReport` component **only when the dialog is open**. The `useEffect` that persists the report to `vizzy_memory` only runs when `OverviewReport` mounts (i.e., when clicked).
- The dialog click may fail because the button is inside an `AccordionItem` wrapper — Radix's `AccordionTrigger` can interfere with nested interactive elements depending on DOM structure.

## Solution

### 1. Always persist reports (for Vizzy voice context)
**New hook: `src/hooks/useEagerReportPersistence.ts`**
- Called once in `VizzyBrainPanel` when the "All" view loads
- For each profile, generates the same report text as `OverviewReport` (attendance, performance, activity breakdown)
- Upserts each user's report to `vizzy_memory` with the same category pattern (`user_daily_report_{userId}_{date}`)
- This runs automatically, independent of any dialog being opened
- Uses `useUserPerformance` and `useDetailedActivityReport` data that's already available in the panel

### 2. Fix the dialog click
**File: `src/components/vizzy/VizzyBrainPanel.tsx`** (lines 1035-1070)
- Move `SectionDetailReportDialog` outside the `AccordionItem` flex container to prevent click interference
- Or: Replace the embedded `SectionDetailReportDialog` with a controlled `Dialog` (state-managed `open`/`setOpen`) triggered by a standalone button with proper `e.stopPropagation()` and `e.preventDefault()` to prevent accordion toggle

**File: `src/components/vizzy/SectionDetailReport.tsx`** (lines 619-629)
- Add `e.preventDefault()` alongside `e.stopPropagation()` on the trigger button to fully prevent accordion/parent interference

### 3. Keep existing behavior intact
- The `OverviewReport` component's internal `useEffect` that saves to `vizzy_memory` remains as a backup
- The eager persistence hook provides the same data proactively

## Changes

| File | Change |
|------|--------|
| `src/hooks/useEagerReportPersistence.ts` | New hook — auto-generates and persists daily reports for all users to `vizzy_memory` |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Call `useEagerReportPersistence` in "All" view; fix dialog button placement/propagation |
| `src/components/vizzy/SectionDetailReport.tsx` | Add `e.preventDefault()` to trigger button to fix click issue |

No database changes needed.

