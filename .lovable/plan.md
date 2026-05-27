# Release-Gate Hardening — Revised Plan (v2)

Additive, backward-compatible. No column renames. No data mutation. Legacy values tolerated.

## Corrections applied vs v1

1. **No time-based expiry.** Evidence validity is a non-expiring boolean (`evidence_valid` + `invalidated_at`).
2. **Renamed:** `release_overrides` → `workflow_overrides`; `release_with_override` → `workflow_override_transition`.
3. **Delivery states added** to all three vocabularies: `ready_for_delivery, driver_assigned, in_transit, delivered`.
4. **Pickup display** shows manifest badge + operational summary line; per-item states only inside expandable Details.
5. **Clearance gate sits on the entity transition** (item `phase`, bundle `status`) — `clearance_evidence` is the precondition, not the sole enforcement point.

## Live-data reality (verified via read_query)

- `cut_plan_items.phase`: `queued (8)`, `cut_done (1)`, `clearance (5)`, `complete (733)`.
- `bundles.status`: `created (5)`.
- `cut_plans.status`: `draft, queued, completed`.
- `clearance_evidence.status`: `pending, cleared`. `verification_state`: `pending, product_captured, tag_scanned, complete`.
- `app_role` enum already contains `admin`, `workshop`, `shop_supervisor` (no new role invented).
- `workflow_overrides` does not exist. `machine_runs` exists.

## 1. Single additive migration

### 1a. Evidence validity columns

```sql
ALTER TABLE clearance_evidence
  ADD COLUMN evidence_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN invalidated_at timestamptz,
  ADD COLUMN invalidated_by uuid,
  ADD COLUMN invalidation_reason text;
```

Evidence is valid iff `verified_at IS NOT NULL AND evidence_valid = true AND invalidated_at IS NULL`. No clock-based expiry anywhere.

### 1b. State vocabulary CHECKs (`NOT VALID` → `VALIDATE CONSTRAINT`)

```text
cut_plan_items.phase ∈ {
  queued, cutting, bent, cut_done, clearance, cleared, zoned,
  loading, loaded, ready_for_pickup, picked_up,
  ready_for_delivery, driver_assigned, in_transit, delivered,
  complete, closed
}

bundles.status ∈ {
  building, ready_for_clearance, cleared, zoned,
  loading, loaded, ready_for_pickup, picked_up,
  ready_for_delivery, driver_assigned, in_transit, delivered,
  closed, created  -- legacy alias
}

cut_plans.status ∈ {
  planning, draft, queued, in_production, ready_for_clearance,
  cleared, ready_for_release, released,
  ready_for_delivery, driver_assigned, in_transit, delivered,
  completed, archived
}
```

### 1c. Adjacency triggers (`BEFORE UPDATE`)

Three `validate_<entity>_transition` functions. After `loaded`, two parallel branches:

```text
loaded → ready_for_pickup → picked_up → closed
loaded → ready_for_delivery → driver_assigned → in_transit → delivered → closed
```

Legacy bridges accepted: `cut_done → clearance`, `cut_done → bent`, `created → building`.

Override path: `current_setting('app.override_reason', true)` non-empty AND caller has `admin` or `shop_supervisor` → allowed, logged.

### 1d. Clearance gate on the ENTITY transition (correction #5)

`validate_cut_plan_item_transition` blocks `phase → cleared` unless the joined `clearance_evidence` row satisfies:

1. `material_photo_url IS NOT NULL`
2. `tag_scan_url IS NOT NULL` OR `verification_state = 'manual_verified'`
3. `verified_by IS NOT NULL AND verified_at IS NOT NULL`
4. `evidence_valid = true AND invalidated_at IS NULL`
5. Confidence matrix:
   - `ai_confidence >= 0.95` → auto-pass
   - `0.70 ≤ ai_confidence < 0.95` → require approved `manual_review_decisions` row
   - `ai_confidence < 0.70` OR NULL → blocked

`validate_bundle_transition` applies the same check to every item linked to a bundle moving to `cleared`.

A lighter trigger on `clearance_evidence` keeps fields 1–4 enforced when `status → cleared`, but the authoritative release decision lives on the entity transition.

### 1e. Cutter / Pool gates

In `validate_cut_plan_item_transition`:
- `queued → cutting` requires associated `machine_runs` row (linkage check; fallback `cut_plans.status IN ('in_production','queued')` flagged in audit).
- `bent → clearance` and `cut_done → clearance` require `bend_completed_pieces = total_pieces`.

### 1f. New tables

```sql
public.workflow_overrides (
  id uuid pk default gen_random_uuid(),
  company_id uuid not null,
  actor_id uuid not null,
  entity_type text not null check (entity_type in
    ('cut_plan_item','bundle','cut_plan','clearance_evidence')),
  entity_id uuid not null,
  from_state text,
  to_state text not null,
  reason text not null check (length(reason) >= 10),
  created_at timestamptz not null default now()
);

public.manual_review_decisions (
  id uuid pk default gen_random_uuid(),
  company_id uuid not null,
  evidence_id uuid not null references clearance_evidence(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approved','rejected')),
  reason text,
  created_at timestamptz not null default now()
);
```

GRANTs: `SELECT, INSERT` to `authenticated`; `ALL` to `service_role`.
RLS: SELECT via `is_company_member(company_id)`.
- `workflow_overrides` INSERT: `auth.uid() = actor_id` AND (`has_role(auth.uid(),'admin') OR has_role(auth.uid(),'shop_supervisor')`).
- `manual_review_decisions` INSERT: `auth.uid() = reviewer_id` AND (`has_role(auth.uid(),'admin') OR has_role(auth.uid(),'shop_supervisor') OR has_role(auth.uid(),'workshop')`) — all three roles already exist in the `app_role` enum.

### 1g. State alias view

```sql
create view public.entity_state_v with (security_invoker=true) as
  select id, company_id, 'cut_plan_item' as entity_type, phase as state from cut_plan_items
  union all select id, company_id, 'bundle', status from bundles
  union all select id, company_id, 'cut_plan', status from cut_plans;
```

### 1h. Override RPC

```sql
create function public.workflow_override_transition(
  _entity_type text, _entity_id uuid, _to_state text, _reason text
) returns void
language plpgsql security definer set search_path = public;
```

1. Verify caller has `admin` or `shop_supervisor`.
2. Validate `length(_reason) >= 10`.
3. INSERT `workflow_overrides` row.
4. `PERFORM set_config('app.override_reason', _reason, true);`
5. UPDATE the target table's state column to `_to_state`.

## 2. Edge function alignment

Surgical only — `manage-inventory`, `manage-bend` (`complete-bend`, `start-bend`), and clearance/loading mutation paths: keep current UPDATE, catch trigger errors and re-raise with `WORKFLOW_GATE_*` codes for friendly frontend messages. No business-logic rewrites.

## 3. Frontend (minimal)

- New `src/components/shopfloor/OverrideReasonDialog.tsx` — reuses `dialog.tsx`. Reason ≥10 chars. Calls `workflow_override_transition`. Visible only when `useUserRole()` returns `admin` or `shop_supervisor`.
- Clearance station: catch `WORKFLOW_GATE_*`, show inline blocker + role-gated "Request supervisor override" button.
- **PickupStation display (correction #4):**
  - Manifest-level **badge** at top (single state badge).
  - **Operational summary line** directly under it:
    `{loadedCount} loaded · {missingCount} missing · {exceptionCount} exceptions`
  - Per-item states collapsed inside an expandable **Details** section (closed by default). No per-item badges in the summary view.
  - Counts derived client-side from existing item state data; no new endpoints.
- No other redesign.

## 4. Regression tests (`tests/regression/shopfloor/`)

- `state-transition-adjacency.test.ts` — invalid jumps rejected; legacy bridges allowed; delivery branch reachable from `loaded`.
- `clearance-gate-entity.test.ts` — item/bundle transition to `cleared` blocked when any of (photo, tag/manual, verified_by/at, evidence_valid, invalidated_at) fail; confidence-matrix branches.
- `evidence-validity.test.ts` — invalidated evidence (`evidence_valid=false` or `invalidated_at` set) blocks transition; no time-based expiry.
- `workflow-override-permissions.test.ts` — non-admin/non-supervisor blocked from RPC; reason <10 chars rejected; success logs `workflow_overrides` row.
- `cutter-pool-gates.test.ts` — `queued→cutting` without machine_run blocked; `bent→clearance` with incomplete bend blocked.
- `pickup-summary-render.test.tsx` — Pickup view renders manifest badge + summary line; per-item badges only inside expanded Details.

## 5. Phase 1 gap audit (deliverable, after migration + tests pass)

`docs/engineering/phase1-gap-audit.md` — maps the Phase 1 spec's 12 sections (Pool, Stations, Cutter, Clearance, Loading, Packing Slip, Pickup, Delivery, Inventory, Camera AI, Audit, AI Automation) against current code as EXISTS / PARTIAL / MISSING with file refs. No code changes from the audit in this pass.

## Execution order (build mode)

1. Run single migration.
2. Update edge functions to surface `WORKFLOW_GATE_*` error codes.
3. Add `OverrideReasonDialog`; wire into Clearance station; update Pickup display.
4. Add regression tests; `bunx vitest run tests/regression/shopfloor`.
5. Write `phase1-gap-audit.md`.

## Risk & rollback

- All schema changes additive: rollback = `DROP TRIGGER` + `DROP FUNCTION` + `DROP CONSTRAINT` + `DROP TABLE workflow_overrides, manual_review_decisions` + `ALTER TABLE clearance_evidence DROP COLUMN evidence_valid, invalidated_at, invalidated_by, invalidation_reason`. No row mutation.
- Legacy values (`cut_done`, `complete`, `created`) explicitly allowed so 733 existing rows validate.
- Override RPC provides escape hatch for operational edge cases, all logged with mandatory reason.

Awaiting approval to run the migration.
