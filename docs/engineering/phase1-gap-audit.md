# Phase 1 Gap Audit — Release-Gate Hardening

_Last updated: 2026-05-27_

## 1. Scope

Phase 1 set out to install hard release-gate plumbing across the cutting → clearance → loading → pickup → delivery flow:

- `workflow_override_transition` SECURITY DEFINER RPC
- `workflow_overrides` audit log table
- `manual_review_decisions` table
- `evidence_valid` boolean + supporting columns on clearance evidence
- `validate_*_transition` trigger functions that raise `WORKFLOW_GATE_*` and `WORKFLOW_OVERRIDE_*` errors with canonical SQLSTATEs
- Backfill + adjacency walker for `cut_plans.status` and `cut_plan_items.phase`

## 2. Status per deliverable

| Deliverable                          | Migration / file                                                                 | Shipped | Verified by |
|--------------------------------------|----------------------------------------------------------------------------------|---------|-------------|
| `workflow_override_transition` RPC   | `supabase/migrations/20260527202349_*.sql`                                       | Y       | Drift check in `OverrideReasonDialog.test.tsx` |
| `workflow_overrides` audit log       | same migration                                                                   | Y       | Referenced in dialog description, asserted in test |
| `manual_review_decisions`            | same migration                                                                   | Y       | Schema present; UI consumer pending Phase 3 |
| `evidence_valid` column + triggers   | same migration                                                                   | Y       | Used by `ClearanceCard.tsx` wiring |
| `validate_*_transition` gate raises  | same migration                                                                   | Y       | `mapWorkflowGateError.test.ts` |
| Adjacency walker + auto-advance fix  | `supabase/migrations/20260527205409_*.sql`                                       | Y       | Manual stroke repro on `/shopfloor/station` |
| WO status sync from item phase       | `supabase/migrations/<wo_sync_status_from_items>`                                | Y       | DB query: WO-MPO4ZAZD advanced to `in_progress` |

## 3. Gaps found in Phase 1 (and Phase 2 disposition)

- **Edge functions swallowed `WORKFLOW_GATE_*` as a generic 500.** ✅ Closed in Phase 2 via `mapWorkflowGateError` in `supabase/functions/_shared/requestHandler.ts`; gate code + raw message now surface to clients.
- **No UI affordance to capture an override reason at the Clearance card.** ✅ Closed by `OverrideReasonDialog` + wiring in `ClearanceCard.tsx`.
- **Pickup manifest had no at-a-glance status / counts.** ✅ Closed by inline manifest summary in `src/pages/PickupStation.tsx` (badge + `loaded · missing · exceptions` line + collapsed Details).
- **Legacy `auto_advance_*` triggers jumped non-adjacent states, blocking strokes.** ✅ Closed in `20260527205409_*.sql` (adjacency walker, item phase routing fix, legacy status normalisation, backfill).
- **WOs with all items past cutting kept showing READY + a dead Start button.** ✅ Closed by `_wo_sync_status_from_items` trigger + backfill + hook-side filter on `useSupabaseWorkOrders`.

## 4. Deferred items (out of Phase 2 scope)

- **LoadingStation manifest parity.** PickupStation got the badge + summary; LoadingStation intentionally untouched. Track in Phase 3.
- **Role expansion.** Override authority stays at `admin` / `shop_supervisor`. No new roles added or surfaced.
- **Evidence retention policy.** `clearance_evidence` rows are kept indefinitely; no TTL or archival sweep.
- **Override-rejected UI.** When `workflow_override_transition` is blocked by RLS the user currently sees the raw error in a toast; no dedicated empty/error state.
- **Manual review consumer UI.** `manual_review_decisions` is writable but has no dashboard yet.

## 5. Verification matrix

| Surface                              | Automated coverage                                                            | Manual repro |
|--------------------------------------|--------------------------------------------------------------------------------|--------------|
| `WORKFLOW_GATE_*` pass-through       | `tests/regression/workflow-gate/mapWorkflowGateError.test.ts` (8 cases + drift)| Trigger an adjacency violation via an edge fn and confirm the toast shows `WORKFLOW_GATE_ADJACENCY` |
| Override dialog contract             | `tests/regression/workflow-gate/OverrideReasonDialog.test.tsx` (5 spec + 5 drift) | On `/shopfloor/station` → Clearance: try a 9-char reason (blocked), 10+ char reason (RPC fires, toast confirms) |
| Pickup manifest summary              | `tests/regression/workflow-gate/PickupManifestSummary.test.tsx` (4 spec + 3 drift)| Open a Pickup bundle, verify badge + `N loaded · N missing · N exceptions` + collapsible Details |
| WO status sync                       | DB query in chat (`work_orders.status` for `WO-MPO4ZAZD` = `in_progress`)     | Reload `/shopfloor/station`, stale READY rows are gone |

Run all regression tests with:

```bash
bunx vitest run --environment=node tests/regression/workflow-gate
```

(Node env is required because the repo-wide jsdom canvas binding is missing; see §6.)

## 6. Risk register

- **Single-hop walker per stroke.** `_cut_plan_next_hop` advances one adjacency edge per trigger fire. Plans needing multiple hops catch up over subsequent updates rather than in one shot. Acceptable today; revisit if a plan stalls visibly.
- **Override toast surfaces raw RPC errors.** Gate codes are now visible but unstyled. UX polish deferred.
- **Repo-wide jsdom canvas binding missing.** Every `.test.tsx` using `@testing-library/react` currently fails at module load time. Phase 2 tests work around this by running under the Node env with spec-mirror + drift checks. A dedicated infra ticket should restore the React DOM test path.
- **WO status sync trigger is permissive of fresh inserts.** It only advances `pending → in_progress`; it never demotes. Safe by design, but means a manual rollback in the DB will not re-surface a WO in the cutter queue without manually resetting phases.
- **Drift checks are string-match based.** They will not catch semantic-only refactors that preserve substrings. They are a tripwire, not a proof.

## References

- `supabase/functions/_shared/requestHandler.ts` — `mapWorkflowGateError`
- `src/components/shopfloor/OverrideReasonDialog.tsx`
- `src/components/clearance/ClearanceCard.tsx`
- `src/pages/PickupStation.tsx`
- `src/hooks/useSupabaseWorkOrders.ts`
- `src/lib/workOrderDispatch.ts`
- `docs/engineering/bugfix-checklist.md`
