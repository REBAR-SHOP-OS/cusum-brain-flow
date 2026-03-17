

# Make CEO Portal Comprehensive & Distinct from Live Monitor

## Problem
The CEO Portal and Live Monitor currently overlap heavily — both show machine fleet, production pulse, phase counters. The user wants:
- **CEO Portal** = strategic command center (super admin only) — comprehensive, executive-level
- **Live Monitor** = operational shop status (sales managers) — real-time machine/production focus

## Key Finding
4 existing CEO-specific components are **built but not rendered**:
- `DailyBriefingCard` — AI-generated executive briefing
- `SLATrackerCard` — SLA deadline tracker with breach warnings  
- `FixRequestQueue` — Bug/fix request queue with Lovable command generator
- `DailyAssignments` — Prioritized action items (do-now / review-today / watch-week)

## Plan

### 1. Add Missing CEO Components to Dashboard
Wire in the 4 orphaned components to `CEODashboardView.tsx`:

```
Layout order (top to bottom):
├── Header + Alerts Banner (keep)
├── Daily Briefing Card ← NEW (AI briefing right at top)
├── Health Score Hero (keep)
├── KPI Grid 6-cards (keep)
├── SLA Tracker Card ← NEW (deadline-aware escalation view)  
├── Production Pulse + Financial Health row (keep)
├── Charts row (keep)
├── Daily Assignments ← NEW (prioritized action items from exceptions)
├── Exceptions Workbench (keep)
├── Fix Request Queue ← NEW (system bug tracker)
├── Recent Orders (keep)
├── Meeting Intelligence (keep)
├── AI Token Usage (keep)
├── Drawers (keep)
```

### 2. Remove Operational Overlap from CEO Portal
Remove the **Phase Counters** section (lines 399-424: Queued/In Progress/Completed/Machines Running) and the **Operations Strip** section (lines 427-456: Deliveries/Pickups/Comms/Social/Team/Inventory) — these are Live Monitor territory. The CEO already sees these numbers via the KPI cards and Health Score drivers.

### File Changes

| File | Change |
|------|--------|
| `src/components/office/CEODashboardView.tsx` | Import + render `DailyBriefingCard`, `SLATrackerCard`, `FixRequestQueue`, `DailyAssignments`. Remove Phase Counters and Operations Strip sections. |

Single file edit — no database or backend changes needed.

