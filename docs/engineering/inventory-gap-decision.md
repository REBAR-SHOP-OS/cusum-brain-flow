# Inventory Gap Decision

**Status:** Partially implemented — deferred for now.
**Owner:** Shop Floor / Office
**Date:** 2026-05-29

## Current status

The inventory **counting** UI is wired end-to-end at the **paper layer** only:
draft → in_progress → completed → approved. **No physical or system stock
is adjusted at any step.** The "Approve" button currently looks like a
commit action but does not post anything back to `inventory_lots` or
`cut_output_batches`.

This is intentional for now — we are not building a full inventory module
in this slice. The decision is to **keep the counting UI as a record-only
worksheet** until a proper adjustment posting flow is designed.

## What exists

- Tables: `inventory_counts`, `inventory_count_lines`, `inventory_lots`,
  `inventory_reservations`, `inventory_scrap`.
- Page: `src/pages/InventoryCountPage.tsx` →
  `src/components/shopfloor/InventoryCountView.tsx`.
- Hook: `src/hooks/useInventoryCounts.ts` — create count, pre-populate
  lines from `rebar_sizes` + summed `cut_output_batches.qty_available`,
  enter counted qty per line, compute variance, flip status.
- Edge function `manage-inventory` — handles **lot consumption at cut
  start** (used by `CutterStationView`). Unrelated to counts/approval.

## What is missing

1. **Adjustment posting.** `status = 'approved'` is a flag change only.
   There is no write-back to `inventory_lots` / `cut_output_batches` to
   reconcile system qty with counted qty.
2. **Variance approval gate.** No second-person approval, no reason code,
   no audit row for who accepted a variance.
3. **Locking.** Lines remain editable conceptually after "complete"; no
   freeze of expected_qty snapshot, no protection against concurrent
   consumption changing expected qty mid-count.
4. **Scope / location semantics.** `count_type` and `location` are free
   text; no link to a physical zone, rack, or yard area.
5. **Cycle scheduling.** No recurring cycle plan, no reminders, no
   coverage report (which SKUs counted in last N days).
6. **Edge function coverage.** `manage-inventory` has no Deno tests for
   the lot-consume path (already noted in `CleanupReport`).

## Operational risk

- **High (today's risk):** A user can click **Approve** and believe stock
  is now corrected. It isn't. Variance disappears into a flag.
  → Mitigated in this slice by a visible banner + button label that
    explicitly says counts are not active yet.
- **Medium:** Pre-populated `expected_qty` is a snapshot at create time;
  if cutting consumes inventory while a count is open, the variance
  becomes meaningless. No documented procedure freezes the floor during a
  count.
- **Low:** Counts are visible only to the same company (RLS scoped), so
  no cross-tenant leakage risk.

## Recommended future slice (when prioritized)

**count → variance → approval → adjustment**

1. **count** — already exists; add an `expected_snapshot_at` timestamp
   and freeze the snapshot when status flips to `in_progress`.
2. **variance** — promote `inventory_count_lines.variance` to a stored
   value with reason codes (`shrinkage`, `misplaced`, `damage`,
   `data_error`, `other`); require a reason when |variance| > threshold.
3. **approval** — require a different `approved_by` than `counted_by`;
   record `approved_at`; write an `activity_events` audit row
   (`source='inventory_count_approval'`) like the clearance verify audit.
4. **adjustment** — on approval, insert offsetting rows into
   `inventory_lots` (or a new `inventory_adjustments` table) and update
   `qty_on_hand`. Wrap in a SECURITY DEFINER function with explicit
   `SET search_path = public`. Emit an `audit` event per line adjusted.

Until that slice lands, the UI must clearly communicate that approval
does **not** move stock.

## Decision

Defer the full module. Keep counting UI usable as a worksheet. Add a
non-removable warning banner + button label so no one mistakes "Approve"
for a stock adjustment.
