

## Plan: Update "Bars to Load" Counter to Reflect Active Bars During Run

### Problem
When a run is active and bars are removed (completed partial bars or supervisor removals), the "Bars to Load" display stays at the original locked count. It should decrease to show only active bars remaining.

### Root Cause
- `CutEngine` line 249 displays `lockedBars` during a run, which comes from `slotTracker.slots.length` (total slots, including removed/completed)
- The `activeBars` prop is already passed correctly but never used in the display

### Changes

**File 1: `src/components/shopfloor/CutterStationView.tsx`**
- Change line 1046: pass `activeBars` count instead of total slot count for `lockedBars`
  - From: `lockedBars={machineIsRunning ? slotTracker.slots.length : undefined}`
  - To: `lockedBars={machineIsRunning ? slotTracker.slots.filter(s => s.status === "active" || s.status === "removable").length : undefined}`

This single change makes the "Bars to Load" counter decrease in real-time as bars complete or get removed, while still showing the original count before the run starts.

### What stays the same
- Supervisor override logic — unchanged
- Slot tracker internals — unchanged
- All other CutEngine props — unchanged

