## Goal

Every intake (one uploaded barlist/manifest) flows end-to-end as its own isolated stream — pool → cutter → bender → clearance → loading → pickup/delivery — so two intakes for the same customer (e.g. Torcom ECA R1 vs. Sina's bundle) can never bleed into each other again.

Scope unit: **Project + Intake**. A `project_id` already groups intakes for the same job; `intake_id` (= the source `barlists.id`) keeps each upload isolated within it. Both are required on every row.

## Architecture

```text
barlist (intake)
   └─ cut_plan (1..n per intake)         intake_id = barlist_id
        └─ cut_plan_item                 intake_id stamped, project_id stamped
             ├─ clearance_evidence       inherits intake_id via FK
             ├─ loading_checklist        intake_id stamped
             ├─ packing_slips            intake_id stamped
             ├─ bundles                  intake_id + project_id stamped
             ├─ pickup_orders            intake_id stamped
             └─ deliveries               intake_id stamped
```

`cut_plans` already has `barlist_id` + `project_id`. We promote `barlist_id` (aliased as `intake_id`) and `project_id` down the chain so every station can filter without joining four tables.

## Steps

**1. Schema — add `intake_id` to the pipeline tables** *(migration)*
- Add nullable `intake_id uuid` (+ `project_id uuid` where missing) to: `cut_plan_items`, `bundles`, `loading_checklist`, `packing_slips`, `pickup_orders`, `pickup_order_items`, `deliveries`, `delivery_stops`, `delivery_bundles`, `work_orders`, `clearance_evidence`.
- FK `intake_id → barlists(id) ON DELETE SET NULL`.
- Indexes `(intake_id)` and `(project_id, intake_id)` on each.
- DB trigger `stamp_intake_from_cut_plan()` on `cut_plan_items` BEFORE INSERT/UPDATE: copies `intake_id` + `project_id` from parent `cut_plans`. Mirror triggers on `bundles`, `loading_checklist`, `packing_slips`, `pickup_orders`, `deliveries` to copy from referenced `cut_plan_item` / `cut_plan`.

**2. Backfill from source links** *(same migration, idempotent)*
- `cut_plan_items.intake_id` ← `cut_plans.barlist_id` via `cut_plan_id`.
- `bundles.intake_id` ← from `source_cut_batch_id` → cut_batch → cut_plan → barlist; fall back via `source_bend_batch_id`; fall back via `source_job_id`.
- `loading_checklist`, `packing_slips`, `pickup_orders`, `deliveries`: copy from `cut_plan_id` chain.
- `delivery_stops`/`delivery_bundles`: copy from parent delivery/bundle.
- Rows that can't be resolved stay NULL (visible in admin reassignment list — step 6 future work; not built now per "Backfill from source links" choice).
- Log counts to `migration_logs` so we can audit unscoped orphans.

**3. Server-side enforcement**
- Edge functions / RPCs that create cut_plans, bundles, loading lists, deliveries must accept and pass `intake_id`. Audit: `dispatchService.ts`, `barlistService.ts`, `inventoryService.ts`, `supabase/functions/finalize-cut-batch`, `create-bundle*`, `release-to-loading*`, `assign-delivery*`. Triggers in step 1 are the safety net; explicit passing is the contract.

**4. Frontend — intake selector + station auto-scope**
- New `IntakeContext` (`src/contexts/IntakeContext.tsx`) holding `{ projectId, intakeId, intakeLabel }` + `localStorage` persistence.
- New top-bar selector in `IndustrialShell` / Shop Floor header: project dropdown → intake dropdown ("SD07 – SIDEWALK_LIGHT POLE 2025-05-22"). "All intakes" option for admins only.
- Update every station hook to filter by `intake_id` when set:
  - `useStationData`, `useProductionQueues`, `useCutPlans`, `useBendBatches`, `useBenderBatches`, `useClearanceData`, `useBundles`, `useReadyToShip`, `usePickupOrders`, plus delivery list query in `DeliveryPipeline.tsx`, `ClearanceArchive.tsx`, `MaterialFlowDiagram.tsx` phase counts.
- `MaterialFlowDiagram` counts re-key on `intakeId`.
- Show intake chip on every tag/card so operators see which stream they're in.

**5. Clearance Archive ↔ Loading consistency**
- The Torcom mismatch we just diagnosed comes from `ClearanceArchive` filtering by customer only. With intake scope on, both the archive and the loading station read the same `intake_id`, so the "18 cleared vs 6 loading" confusion disappears by construction. Add a regression test under `tests/regression/shopfloor/intake-scope-consistency.test.ts` asserting clearance archive count == loading-eligible count for a given intake fixture.

**6. Memory + docs**
- Add `mem://architecture/intake-pipeline-isolation` (HARD): every pipeline row carries `intake_id` (= `barlists.id`) and `project_id`; stations filter by active intake; cross-intake batching forbidden in loading/delivery; cutter/bender may visually mix but each tag shows its intake chip.
- Update `mem://index.md` Core with one-line rule.

## Technical notes

- `intake_id` is intentionally `barlists.id` (not a new surrogate) — barlists are already the upload unit and have RLS by `company_id`. No new table needed.
- Triggers use `SET search_path = public` and `SECURITY DEFINER` only where needed for cross-row reads, per existing standards.
- All new columns nullable to keep deploy non-breaking; NOT NULL can be added later once backfill confirmed clean.
- No changes to existing status/phase enums or workflow gates.
- Tests: `tests/regression/shopfloor/intake-scope-isolation.test.ts` (two intakes same customer don't leak), `intake-backfill.test.ts` (backfill resolves cut_plan_items 100% when cut_plans.barlist_id is set).

## Risk

- Backfill orphans: bundles/deliveries with no traceable barlist (likely the older Torcom data). They stay NULL and admins see them under "Unscoped" — explicitly not auto-reassigned per your choice.
- Selector UX: if a user forgets to switch intake, they'll see an empty pool. Mitigation: top-bar always shows the active intake name in bold + a "Switch intake" affordance; if pool empty, show "No items in this intake — switch?".
