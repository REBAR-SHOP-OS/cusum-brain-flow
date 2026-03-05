

# Fix: Allow Removing Active Bars During a Run

## Problem
When a run is active, operators cannot correct the number of loaded bars. The `removeBar` function in `useSlotTracker` only allows removing bars with `status === "removable"` (partial bars that completed their cuts). If an operator accidentally loads 12 bars but only meant to load 10, there's no way to correct this.

## Solution
Allow operators to remove **active** bars (not just "removable" ones) during a run. This requires changes in 3 files:

### 1. `src/hooks/useSlotTracker.ts`
- Update `removeBar` to also accept bars with `status === "active"` (not just `"removable"`)
- When removing an active bar, set its status to `"removed"` and keep its current `cutsDone`

### 2. `src/components/shopfloor/SlotTracker.tsx`
- Add a section showing active bars with a "Remove" button (styled less urgently than the red "removable" alerts)
- Each active bar shows its index, cuts done so far, and a remove button
- Only visible when there are 2+ active bars (can't remove the last active bar)

### 3. `src/components/shopfloor/CutterStationView.tsx`
- The existing `handleRemoveBar` already handles inventory/remnant logic correctly — no changes needed here since it reads `slot.cutsDone` dynamically

## UI Design
- Active bars get a subtle card with a "Remove" icon button (not the flashing red alert used for "removable" bars)
- Confirmation via AlertDialog to prevent accidental taps: "Remove Bar X? It has Y cuts done. The remnant will be set aside."
- Disabled when only 1 active bar remains (must have at least 1 bar running)

## Technical Details
- `removeBar` guard: change `slot.status !== "removable"` → `slot.status !== "removable" && slot.status !== "active"`
- Add minimum-bars guard: prevent removing if only 1 active slot remains
- The existing `handleRemoveBar` in CutterStationView already computes leftover from `slot.cutsDone` and handles remnant/scrap — works as-is

