

# Fix: Enforce 10M/15M → Cutter-01 and 20M+ → Cutter-02

## Current State
- **`machine_capabilities` table** already has correct data: Cutter-01 handles 10M/15M, Cutter-02 handles 20M/25M/30M/35M
- **`useStationData`** already filters displayed items by machine capabilities (lines 110-133) — so the station view correctly hides incompatible items
- **Problem**: `QueueToMachineDialog` has **zero validation** — users can queue any plan (with any bar codes) to any machine. If a plan contains mixed sizes (e.g. 10M + 20M), it gets assigned entirely to one machine, and the capability filter silently hides incompatible items

## Changes

### 1. `src/components/cutter/QueueToMachineDialog.tsx` — Add validation + auto-split

When the user selects a machine:
- Fetch that machine's capabilities from `machine_capabilities`
- Compare each item's `bar_code` against allowed codes
- If **all items match** → queue normally
- If **some items don't match** → show a warning: "X items (10M, 15M) are not compatible with this machine and will be skipped" with option to auto-split them into a separate plan for the correct machine
- If **no items match** → disable the Queue button with explanation

### 2. `src/components/cutter/QueueToMachineDialog.tsx` — Auto-split logic

When a plan has mixed sizes and user confirms:
1. Create a new `cut_plan` (name = original + " (Auto-Split)") assigned to the compatible machine
2. Move incompatible `cut_plan_items` to the new plan (update `cut_plan_id`)
3. Queue the remaining compatible items to the selected machine
4. Queue the split plan to the correct machine automatically

### 3. Database trigger — `trg_validate_machine_capability`

Add a BEFORE UPDATE trigger on `cut_plans` that validates when `machine_id` changes:
- For each item in the plan, check if `bar_code` exists in `machine_capabilities` for the target machine
- RAISE EXCEPTION if any item is incompatible (fail-safe at DB level)

This provides defense-in-depth: UI warns and auto-splits, DB blocks any remaining violations.

