

## Problem

The "Assign machine" dropdown requires manual selection. The user wants **automatic routing** based on bar size:
- **10M, 15M** → CUTTER-01 (`e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3`)
- **20M and above** → CUTTER-02 (`b0000000-0000-0000-0000-000000000002`)

Currently `machine_id` lives on `cut_plans` (one machine per plan). A plan can have mixed bar sizes.

## Approach

Add auto-assignment logic that triggers when unassigned cut plans are detected. The system will:

1. Fetch the `bar_code` values from `cut_plan_items` for each unassigned plan
2. Apply the routing rule: if all items are 10M or 15M → CUTTER-01, otherwise → CUTTER-02
3. Automatically update `cut_plans.machine_id` and set status to `queued`
4. Replace the manual "Assign machine" dropdown with an "Auto-assigned" badge showing which machine was picked

## Changes

### `src/components/shopfloor/ShopFloorProductionQueue.tsx`

- In the `CutPlanRow` component, add a `useEffect` that fires when an unassigned plan is rendered
- Query `cut_plan_items` for that plan's `bar_code` values
- Apply the rule: if every `bar_code` is `10M` or `15M` → assign CUTTER-01 ID; otherwise → CUTTER-02 ID
- Call the existing `handleAssign` logic automatically
- Show a brief "Auto-assigning..." state, then the assigned machine badge
- Keep a manual override dropdown as fallback (e.g., small "Change" link next to the auto-assigned badge)

### Auto-assign rule (hardcoded for now)

```text
CUTTER-01: bar_code IN ('10M', '15M')
CUTTER-02: bar_code NOT IN ('10M', '15M')  -- i.e. 20M, 25M, 30M, 35M, 45M, 55M
```

If a plan has **mixed** sizes (e.g., 10M + 20M), the larger size wins → CUTTER-02.

