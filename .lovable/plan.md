

# Delete `/shopfloor/live-monitor` Page and All Related Files

## Summary
Complete removal of the Live Monitor standalone page and all components used exclusively by it.

## Files to DELETE (5 files)

| File | Reason |
|------|--------|
| `src/pages/LiveMonitor.tsx` | The page itself |
| `src/components/shopfloor/LiveMachineCard.tsx` | Only used by LiveMonitor |
| `src/components/shopfloor/ProjectLanesView.tsx` | Only used by LiveMonitor |
| `src/components/shopfloor/MachineFilters.tsx` | Only used by LiveMonitor |
| `src/pages/CleanupReport.tsx` | Contains a reference to LiveMonitor -- only the text reference, will be updated not deleted |

## Files to EDIT (3 files)

| File | Change |
|------|--------|
| `src/App.tsx` | Remove the `import LiveMonitor` line and the `/shopfloor/live-monitor` route |
| `src/components/layout/AppSidebar.tsx` | Remove the "Live Monitor" nav item from the QA section |
| `supabase/functions/_shared/pageMap.ts` | Remove the `/shopfloor/live-monitor` entry |

## What will NOT be touched
- `src/hooks/useLiveMonitorData.ts` -- still used by `StationView`, `StationDashboard`, `TransferMachineDialog`
- `src/hooks/useLiveMonitorStats.ts` -- still used by `LiveMonitorView` in AdminPanel
- `src/components/office/LiveMonitorView.tsx` -- still used by AdminPanel tab
- AdminPanel's "Live Monitor" tab -- this is a separate embedded view, not the standalone page
- No database changes, no other UI changes

## Technical Detail: CleanupReport.tsx
Line 48 contains a text reference: `"LiveMonitor.tsx is 244 lines"`. This cleanup item will be removed since the file no longer exists.

