# Stay on Active Project After Completion

## Problem

Two related bugs across the shop floor flow:

1. **Cutter Station (images #1 → #2 vs #4):** When an operator finishes the last cut on an item and the focused `CutterStationView` calls `onBack()`, `StationView` returns to its default customer-grouped view (image #4 — *all customers, all barlists*) instead of the project/barlist the operator was just working in (image #2). All Collapsible accordions reset to their default-collapsed state because the just-finished work order is no longer `in_progress`, so `defaultOpen={cust.hasActiveWork}` evaluates to `false`.

2. **Clearance Station (image #3):** When the last item of a manifest is cleared, the auto-advance trigger moves the items off the `clearance` phase. The realtime invalidation refetches and the project group disappears from `byProject`. Because `selectedProject` is keyed by the project label (which is now gone), the view effectively snaps back to the all-projects list.

In both cases the operator's spatial context (which project / which manifest they were inside) is destroyed.

## Fix

Persist the operator's active context across completions and refetches.

### 1. Cutter Station — keep the active project + barlist after `onBack`

In `src/pages/StationView.tsx`:

- When the focused view returns via `onBack()`, do **not** reset `selectedProjectId` or `selectedBarListId`. They are already preserved (good), but the customer accordion below them collapses everything because of `defaultOpen={cust.hasActiveWork}`.
- Track the **last active customer** in component state (e.g. `lastActiveCustomerName`). Set it from the focused item just before navigating into `CutterStationView` / `BenderStationView` (using `item.customer_name`).
- Change the Collapsible to: `defaultOpen={cust.hasActiveWork || cust.customerName === lastActiveCustomerName}` and pass it as a controlled `open` prop so it stays open after the active run finishes.
- If a `selectedProjectId` is active, auto-expand that project's customer too (so the operator who filtered by project keeps seeing it expanded).
- Inside the expanded customer, also auto-expand the specific barlist that was just worked on (track `lastActiveBarlistId`).

### 2. Clearance Station — keep the operator on the manifest

In `src/pages/ClearanceStation.tsx` and `src/hooks/useClearanceData.ts`:

- Switch `selectedProject` from a label string to a stable `projectKey` (the same `project_id || "__unassigned__"` key used inside `useClearanceData`). Expose this key from the hook so the manifest page can match items even after the project label changes or items disappear.
- After the last item of a manifest is cleared and removed from `visibleItems`, instead of falling through to "No items awaiting clearance", show a brief inline "Manifest complete" state on the same screen with two actions:
  - **Back to projects** (explicit)
  - **Auto-return after 4s** (so the kiosk doesn't get stuck)
- Keep `selectedProject` set during this transitional state so the operator sees confirmation in place rather than being bounced.

### 3. Small consistency tweaks

- In `StationView.tsx`, when the operator clicks an item, also remember `lastActiveCustomerName` and `lastActiveBarlistId` (derived from the clicked item) so the accordion state is correct on return regardless of which entry path was used.
- Clear `lastActive*` only when the user explicitly clicks "Show All Projects" or navigates away from the station.

## Files touched

- `src/pages/StationView.tsx` — track and apply `lastActiveCustomerName` / `lastActiveBarlistId`; controlled Collapsible open state.
- `src/pages/ClearanceStation.tsx` — switch `selectedProject` to project key; add "manifest complete" transitional state.
- `src/hooks/useClearanceData.ts` — expose `byProjectKey` (Map keyed by `project_id || "__unassigned__"`) alongside the existing label-keyed map for backward compat.

## Out of scope

- No DB / RLS / trigger changes. The auto-advance trigger added previously continues to handle phase transitions.
- No changes to `CutterStationView` / `BenderStationView` internals — only the parent decides where to land after `onBack`.
