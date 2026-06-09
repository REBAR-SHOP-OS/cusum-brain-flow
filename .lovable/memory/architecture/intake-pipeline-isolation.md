---
name: Intake Pipeline Isolation
description: Every pipeline row carries intake_id (= barlists.id) + project_id; stations auto-scope to active intake
type: feature
---

# HARD RULE — intake-scoped pipeline

Every row in the production pipeline must carry **`intake_id`** (= `barlists.id`)
and **`project_id`**. One uploaded barlist/manifest = one isolated stream from
pool → cutter → bender → clearance → loading → pickup/delivery.

## Tables that must carry intake_id + project_id

- `cut_plan_items`, `bundles`, `loading_checklist`, `packing_slips`,
  `pickup_orders`, `pickup_order_items`, `deliveries`, `delivery_stops`,
  `delivery_bundles`, `clearance_evidence`
- `cut_plans` already has `barlist_id` + `project_id`; treat `barlist_id` as
  the intake_id at the cut_plan layer.
- `work_orders` already has both.

## Auto-stamp triggers (do NOT remove)

Installed in `supabase/migrations/*` — they fill `intake_id`/`project_id` from
the parent row on every INSERT/UPDATE so application code can omit the field:

- `trg_stamp_intake_cut_plan_items` ← cut_plans
- `trg_stamp_intake_clearance_evidence` ← cut_plan_items
- `trg_stamp_intake_loading_checklist` ← cut_plan_items
- `trg_stamp_intake_packing_slips` ← cut_plans
- `trg_stamp_intake_deliveries` ← cut_plans
- `trg_stamp_intake_delivery_stops` / `trg_stamp_intake_delivery_bundles` ← deliveries
- `trg_stamp_intake_pickup_order_items` ← pickup_orders
- `trg_stamp_intake_bundles` ← cut_batches → cut_plans

## Frontend

- `src/contexts/IntakeContext.tsx` is the single source of truth for the
  active intake. Use `useIntake()` to read `{ intakeId, projectId }`.
- `src/components/shopfloor/IntakeSelector.tsx` is the only selector — mount
  at the top of any shop-floor surface.
- Every station hook MUST filter by `intake_id` when it is set. "All intakes"
  is admin-only and intentionally bypasses the filter.

## Forbidden

- Filtering shop-floor queries by `customer_id` alone (causes the Torcom-style
  "18 cleared vs 6 loading" mismatch).
- Creating loading lists / deliveries / bundles that span multiple intakes.
  Cutter/bender may visually batch across intakes, but each tag must show its
  intake chip.
- Dropping the auto-stamp triggers or the `intake_id` columns.

## Test

`tests/regression/shopfloor/intake-pipeline-isolation.test.ts` asserts the
columns + triggers exist and every key client hook applies the filter.
