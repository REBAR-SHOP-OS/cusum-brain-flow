

# Fix: Supervisor Override Capped at Machine Capacity

## Problem
The CutEngine allows supervisors to set bars up to 99 (line 248), shows an "Over Capacity" warning but still permits starting. The user wants supervisors clamped at machine max — never above.

## Files to Patch

### 1. `src/components/shopfloor/CutEngine.tsx`
- **Line 248**: Cap the `+` button at `maxBars` instead of 99
- **Line 97**: `isOverCapacity` becomes impossible (but keep as safety check)
- **Line 101**: Remove `|| isSupervisor` from `canStart` — over-capacity is never allowed
- **Lines 263-268**: Update helper text:
  - Default: `"Auto-set to max safe load"`
  - Supervisor changed within limit: `"Supervisor override active"`
  - Non-supervisor: `"Auto-set to max safe load"`
- **Lines 271-292**: Replace the "Over Capacity" warning block with a subtle "Capped at machine max capacity: X" notice when supervisor hits the ceiling
- **Line 235**: Display value always from clamped state (already correct after capping buttons)

### 2. `src/components/shopfloor/CutterStationView.tsx`
- **Line 272**: Remove comment about supervisors exceeding maxBars
- **Line 236** (`barsForThisRun`): Already clamps via `Math.min(operatorBars, maxBars)` — correct, no change needed

## Behavior After Fix

| Scenario | Result |
|---|---|
| Need 11, max 2 | Auto-default: 2 |
| Need 1, max 2 | Auto-default: 1 |
| Need 8, max 6 | Auto-default: 6, supervisor capped at 6 |
| Supervisor tries +1 past max | Button disabled, shows "Capped at machine max capacity: 6" |
| Operator | +/- hidden, shows "Auto-set to max safe load" |

No changes to remnant/waste prompt (already working). No DB changes.

