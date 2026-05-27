## Root cause

The stroke save fails because two legacy auto-advance triggers conflict with the new adjacency gate added in `20260527202349`:

1. **`auto_advance_item_phase`** (`20260225235108`) jumps `cut_plan_items.phase` directly from `queued`/`cutting` to **`complete`** for straight (non-bend) items. The new adjacency gate only allows `cutting → bent|cut_done|clearance`, so straight items would also break (not triggered in this card, but latent).

2. **`auto_advance_plan_status`** (`20260420185509`) jumps `cut_plans.status` from whatever it is (here `draft`) directly to **`completed`** (or `cut_done`) when all items are done. The new adjacency gate requires step-by-step transitions (`draft → planning/queued → in_production → … → completed`) and the canonical `cut_plans` status list no longer includes `cut_done`. This is what produces the visible error:

   `WORKFLOW_GATE_ADJACENCY: cut_plans draft → completed not allowed`

The stroke RPC succeeds at writing `completed_pieces`, but the cascading `phase` and `status` updates inside the same transaction get blocked, so the RPC rolls back and the toast shows "Stroke save failed".

## Fix (single migration, surgical, additive)

No frontend or edge-function changes. No new tables, columns, or policies. Only rewrite the two existing auto-advance trigger functions to respect canonical vocabulary and adjacency.

### 1. `auto_advance_item_phase`

Stop emitting non-adjacent target phases.

- Cutting complete + `bend_type = 'bend'`: set phase to `cut_done` (already adjacency-valid from `queued`/`cutting`).
- Cutting complete + straight bar: set phase to `clearance` (adjacency-valid from `queued`/`cutting`; matches the new clearance-before-complete intent — straight bars no longer skip clearance).
- Bending complete: set phase to `clearance` (unchanged, already adjacency-valid from `cut_done`).

### 2. `auto_advance_plan_status`

Rewrite to walk allowed adjacency hops and to use only canonical `cut_plans` statuses.

Logic:

- Compute a target canonical status from item aggregate:
  - all items in `clearance`/`cleared`/beyond → `ready_for_clearance`
  - all items in `cut_done`/`bent`/`clearance`/beyond → `in_production`
  - any item past `queued` → `in_production`
  - otherwise → no change
- Never auto-advance to `completed`. Completion stays a deliberate downstream step (clearance → release → delivered → completed) and is no longer fired by item progress alone. This matches the new gate's intent and avoids the `draft → completed` jump.
- Walk current → target one hop at a time using the same adjacency map as the gate. Each `UPDATE cut_plans SET status = next_hop` passes the gate because each hop is adjacency-valid. No override flag, no `app.override_reason` abuse.
- Remove all references to legacy `cut_done` as a `cut_plans` status.

### 3. Backfill

Re-run a phase no-op on one item per existing plan (same pattern as `20260420185509`) so plans currently sitting on `cut_done` or other legacy statuses are re-evaluated into canonical statuses through the new walker.

## Validation

1. In preview, on the GENSCO DTX 400 10M station, record a stroke on MARK A1001 — the toast `WORKFLOW_GATE_ADJACENCY: cut_plans draft → completed not allowed` must not appear and the run must complete normally.
2. `select status from cut_plans where id = <that plan>` — value is a canonical status (`in_production` or `ready_for_clearance`), not `cut_done` or a stuck `draft`.
3. `select phase from cut_plan_items where cut_plan_id = <that plan>` — straight items land in `clearance`, bend items in `cut_done`; no item is in `complete` purely from cutting.
4. Manual override path (`workflow_override_transition`) and clearance evidence gate remain untouched and still enforce on any explicit transition into `cleared`/`completed`.

## Non-goals

- No changes to `CutterStationView`, `ClearanceCard`, `PickupStation`, edge functions, RLS, roles, or the `workflow_overrides` / `manual_review_decisions` tables.
- No new statuses or columns.
- No rename of existing objects.
- Completion of a plan still requires the proper clearance → release → delivery chain; this fix only stops the illegal auto-jump, it does not invent a shortcut.