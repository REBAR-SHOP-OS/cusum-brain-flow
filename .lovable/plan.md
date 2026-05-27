## Root cause

The Start button on **WO-MPO4ZAZD** correctly raised the toast *"All cuts already complete — nothing to dispatch"*. That message is accurate: a DB check confirms every `cut_plan_item` on this WO is already in `phase = 'clearance'` or `'complete'`. Cutting really is finished.

The actual bug is upstream:

- `work_orders.status` is still `'pending'` (the READY badge) even though no cut work remains.
- The cutter **Work Order Queue** therefore lists this WO with a Start button it can never honor.
- The `0/25 PCS` the user noticed belongs to a *different* WO in the right panel (WO-MPN45DBF / A2001), not to TORCOM. The two got conflated visually because both are on screen.

So two surgical fixes, no schema churn:

## Fix 1 — exclude WOs with no remaining cut work from the cutter queue

In the cutter Work Order Queue source (likely `useSupabaseWorkOrders` / the station data hook that feeds `WorkOrderQueueSection`), filter out any WO whose every `cut_plan_item` has `phase NOT IN ('queued','cutting')`. This is the same eligibility rule `hydrateTasksFromCutPlanItems` already uses, just lifted to the listing query so the Start button never appears for a WO with nothing to dispatch.

Implementation detail: enrich the existing WO query with a per-WO `pending_cut_items` count via a single supplemental query keyed by `barlist_id`, drop WOs whose count is 0.

## Fix 2 — auto-advance `work_orders.status` so the badge reflects reality

Add a small DB trigger on `cut_plan_items` AFTER UPDATE OF phase: when every item belonging to a WO (via `barlist_id → cut_plans → cut_plan_items`) is past cutting (`phase IN ('cut_done','clearance','cleared','complete')`), advance the WO from `pending` → `in_progress` (or to whatever the canonical adjacency map next allows, reusing the new `_cut_plan_next_hop`-style walker pattern). Never auto-complete the WO — completion stays a downstream deliberate step, matching the cut_plans rule.

This keeps the READY badge truthful and means new WOs created after this fix won't accumulate as stale Start rows.

## Fix 3 — clearer toast wording on the click path

If a user still clicks Start on an in-flight stale WO before the queue refreshes, replace *"All cuts already complete — nothing to dispatch"* with *"All cuts done — this work order is ready for clearance, not cutting."* in `src/lib/workOrderDispatch.ts`. Pure copy change, no logic change.

## Non-goals

- No changes to `WorkOrderQueueSection` rendering, no badge map changes.
- No new statuses, columns, or RLS changes.
- No edits to the right-side Active Production panel.
- No touch to `LoadingStation`, `PickupStation`, or `ClearanceCard`.
- No retroactive bulk update of historical WOs beyond what the new trigger naturally re-evaluates when those items are next touched; a one-time backfill UPDATE inside the same migration brings existing WOs in sync.

## Files to change

- `supabase/migrations/<new>_wo_status_sync.sql` — trigger + function + one-time backfill UPDATE for existing `work_orders.status`.
- `src/hooks/useSupabaseWorkOrders.ts` (or the matching station-data hook feeding the cutter queue) — filter out WOs with zero queued/cutting items.
- `src/lib/workOrderDispatch.ts` — toast copy only.

## Validation

1. Reload `/shopfloor/station`. WO-MPO4ZAZD no longer appears under TORCOM in the cutter Work Order Queue.
2. DB check: `SELECT status FROM work_orders WHERE work_order_number = 'WO-MPO4ZAZD';` returns a non-`pending` status.
3. A new test WO with items still in `queued` phase still appears with a working Start button.
4. Clicking Start on an edge-case stale WO (if any race remains) shows the new, clearer toast.
