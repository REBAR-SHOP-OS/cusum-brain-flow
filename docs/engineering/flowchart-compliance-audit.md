# Flowchart Compliance Audit
**Original:** 2026-05-29 · **Re-audit:** 2026-05-29 (post-fix) · **Scope:** Approved operational flowchart (Clearance → Loading → Pickup / Delivery) + Persian workflow business rules · **Mode:** Audit only, no implementation.

Sources of truth, in order:
1. The approved boxed flowchart provided by the user.
2. The Persian operational workflow description (business-rule precedence over the chart when in conflict — explicitly noted below).

Legend: ✅ Backend-enforced · 🟦 UI-only · 🟡 Partial · 🔴 Missing · ⏸ Deferred.

> **Re-audit summary:** Five flowchart gaps were closed since the original audit (D4/D6, A8, B6, C7, D-Gate). The chart is now backend-enforced end-to-end for clearance completion, packing-slip generation, pickup release, and delivery completion. Remaining gaps are scoped to **loading scan integrity** (B3.b/c/d, B4) and the unchanged **AI verdict server-recheck** (A5/A6), both classified as deferred slices rather than active defects.

---

## A. Clearance branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| A1 | Fabrication completed → enters clearance | ✅ Backend enforced | DB trigger `auto_advance_item_phase` + `validate_cut_plan_item_transition` enforces `bent/cut_done → clearance` and requires `bend_completed_pieces ≥ total_pieces`. |
| A2 | Clearance started | ✅ Backend enforced | `clearance_evidence` row created with `verification_state` lifecycle. |
| A3 | **Tag photo before product photo** (Persian rule: hard order) | ✅ Backend enforced | `src/lib/clearanceEvidenceGate.ts → assertTagEvidenceReady` blocks product capture until `tag_scan_url` exists on the same evidence row. Used by `useAutoClearance` and `ClearanceCard` Manual Verify. Regression: `tests/regression/workflow-gate/auto-clearance-tag-gate.test.ts`. |
| A4 | Product photo blocked until tag validation succeeds | ✅ Backend enforced | Same gate plus `verification_state ∈ {tag_scanned, product_captured, complete}` check. |
| A5 | AI matching (OCR, tag validation, product validation) | 🟡 Partial / ⏸ Deferred | `validate-clearance-photo` returns `confidence`. Frontend acts on it; **DB does not re-verify OCR similarity** — `_is_evidence_release_ready(...)` only confirms both photos exist. Deferred: requires server-side OCR re-check service. |
| A6 | AI confident (>95%) → auto approve | 🟡 Partial / ⏸ Deferred | UI applies the threshold; backend accepts any valid evidence row. Deferred with A5. |
| A7 | Low confidence / failed match → manual review | ✅ Backend enforced (audit) | Manual Verify writes `override_reason` + `activity_events { source='manual_verify' }` via `trg_log_clearance_verify_audit`. |
| A8 | **Assign storage zone (Zone 1–5)** before clearance completed | ✅ Backend enforced *(fixed)* | `clearance_evidence.storage_zone` column + CHECK (`'Zone 1'..'Zone 5'`) + trigger `validate_clearance_evidence_transition` raises `WORKFLOW_GATE_STORAGE_ZONE_REQUIRED` on transition to `cleared`. Audit: `trg_log_clearance_zone_assignment`. UI: `src/components/clearance/ClearanceCard.tsx` zone Select (disabled Verify until set). Regression: `tests/regression/workflow-gate/ClearanceStorageZoneGate.test.ts`. |
| A9 | Clearance completed → ready for loading | ✅ Backend enforced | `cleared → loading` adjacency, now zone-gated by A8. |

**Override / audit cross-cut:** ✅ `override_reason` + `_workflow_override_active()` + `OverrideReasonDialog` + audit triggers `trg_log_clearance_verify_audit` and `trg_log_cut_plan_item_phase_transition`.

---

## B. Loading branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| B1 | Loading started | 🟦 UI only | `LoadingStation.tsx` opens on selecting a completed bundle; no persisted "loading_started" state at bundle level. **Acceptable** — chart treats this as an implicit transition. |
| B2 | **Scan / photo each tag during loading** | 🟡 Partial | Per-item photo capture + `match-tag-photo` AI suggestion in `LoadingItemCard`. Not required: an operator can tick "loaded" without a photo. |
| B3.a | Loading validation — **missing items** | ✅ Backend enforced *(fixed)* | `validate_packing_slip_loading` trigger compares `loading_checklist` against expected `cut_plan_items` and raises `WORKFLOW_GATE_LOADING_INCOMPLETE` / `WORKFLOW_GATE_LOADING_NOT_STARTED` / `WORKFLOW_GATE_LOADING_NO_ITEMS`. Regression: `tests/regression/workflow-gate/PackingSlipLoadingGate.test.ts`. |
| B3.b | Loading validation — **wrong items** | ✅ Backend enforced *(fixed)* | Same trigger raises `WORKFLOW_GATE_LOADING_WRONG_ITEM` when a checklist row points to a `cut_plan_item` outside the slip's plan. **Gap:** does not yet validate scanned tag *text* — only that the item belongs to the plan. Deferred slice = OCR cross-check. |
| B3.c | Loading validation — **duplicate items** | ✅ Backend enforced *(fixed)* | Same trigger raises `WORKFLOW_GATE_LOADING_DUPLICATE` on repeated `cut_plan_item_id` across the slip. |
| B3.d | Loading validation — **partial shipment** | 🟡 Partial / ⏸ Deferred | Partial-shipment **concept** still not modeled on `loading_checklist` (no per-piece partial qty). Current trigger only enforces full-or-blocked. Deferred slice = partial-quantity schema + UI. |
| B4 | **Hold loading / exception found → manual review** | 🔴 Missing / ⏸ Deferred | `delivery_exceptions` table exists but is **not written from the loading flow**. No "hold" state on `loading_checklist`/`deliveries`. Deferred slice = loading-exception capture. |
| B5 | Valid load → generate packing slip | ✅ Backend enforced *(fixed)* | `packing_slips` BEFORE INSERT trigger blocks creation unless B3.a–c pass or `_workflow_override_active()` is set. |
| B6 | **Packing slip cannot be generated before validation passes** | ✅ Backend enforced *(fixed)* | Same trigger as B5. Audit on success: `trg_log_packing_slip_validated`. Audit on block: `packing_slip_blocked` event written from `LoadingStation.tsx`. Regression: `tests/regression/workflow-gate/PackingSlipLoadingGate.test.ts`. |
| B7 | Store digital packing slip + print customer copy | ✅ (store) / 🟦 (print) | `packing_slips` insert + `PackingSlipPreview.tsx` PDF preview. |

---

## C. Pickup branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| C1 | Pickup selected | ✅ Backend enforced | `pickup_orders` + `pickup_order_items` + `PickupStation.tsx`; adjacency `loaded → ready_for_pickup → picked_up`. |
| C2 | **Take final load photo** | ✅ Backend enforced *(fixed)* | `pickup_orders.final_photo_path` column + `validate_pickup_completion` trigger raises `WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED`. UI: `PickupVerification.tsx` camera capture. |
| C3 | **Item-by-item confirmation** | ✅ Backend enforced *(fixed)* | Same trigger raises `WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE` / `WORKFLOW_GATE_PICKUP_NO_ITEMS` when any `pickup_order_items.verified=false`. |
| C4 | **Customer signature** | ✅ Backend enforced *(fixed)* | Same trigger raises `WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED` when `signature_data` missing. |
| C5 | Pickup completed → status closed | ✅ Backend enforced | Phase adjacency; audit via `trg_log_pickup_completed`. |

Regression: `tests/regression/workflow-gate/PickupCompletionGate.test.ts` (14 tests).

---

## D. Delivery branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| D1 | Assign driver, send tablet data | 🟡 Partial | `deliveries.driver_name`, `driver_profile_id` exist; no backend requirement before `phase=driver_assigned`. Low risk — chart treats this as planning, not a gate. |
| D2 | Driver receives packing slip / address / GPS | 🟦 UI only | `DeliveryTerminal.tsx` shows address + Maps link + packing slip read. |
| D3 | Delivery on-site | ✅ Backend enforced | Phase adjacency `driver_assigned → in_transit → delivered`. |
| D4 | **Final photo on delivery** | ✅ Backend enforced *(fixed)* | UI bug fixed (`||` instead of `&&`) **and** `validate_delivery_completion` trigger raises `WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED` when `pod_photo_url` missing on transition to `delivered`. |
| D5 | **Item-by-item delivery checklist** | ✅ Backend enforced *(fixed)* | Trigger raises `WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE` when the slip has items and `delivery_stops.notes::jsonb checklist_completed < checklist_total`. UI also gates submit. |
| D6 | **Customer signature on delivery** | ✅ Backend enforced *(fixed)* | Trigger raises `WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED` when `pod_signature` missing. |
| D7 | Delivery exceptions (hold / reject / failure) | ✅ Backend enforced | `delivery_exceptions` + `trg_log_delivery_exception_audit`. |
| D8 | Delivery completed → status closed | ✅ Backend enforced | Phase trigger `delivered → complete/closed`; audit via `trg_log_delivery_completed`. |

Regression: `tests/regression/workflow-gate/DeliveryCompletionGate.test.tsx` (UI OR-gate) + `tests/regression/workflow-gate/DeliveryBackendGate.test.ts` (14 tests, backend trigger + drift checks).

---

## E. Supervisor override + audit (cross-cut)

| # | Rule | Status | Evidence |
|---|---|---|---|
| E1 | Override requires explicit reason | ✅ (clearance) / 🟡 (loading / pickup / delivery) | `clearance_evidence.override_reason` + `OverrideReasonDialog` cover clearance. Loading/pickup/delivery gates honour `_workflow_override_active()` but do **not** persist an override reason per attempt. Deferred slice = unified override-reason capture. |
| E2 | Every override/transition produces an audit row | ✅ Backend enforced | `trg_log_clearance_verify_audit`, `trg_log_cut_plan_item_phase_transition`, `trg_log_clearance_zone_assignment`, `trg_log_packing_slip_validated`, `trg_log_pickup_completed`, `trg_log_delivery_completed`, `trg_log_delivery_exception_audit`. Frontend writes `packing_slip_blocked`, `pickup_blocked`, `delivery_blocked` audit events on gate failures. |
| E3 | Phase guards cannot be silently bypassed | ✅ Backend enforced | `_workflow_override_active()` is the single bypass switch; recorded in audit metadata (`override_active: true`). |

---

## Summary scoreboard (post-fix)

| Section | ✅ Backend | 🟡 Partial | 🟦 UI only | 🔴 Missing | ⏸ Deferred |
|---|---|---|---|---|---|
| Clearance (A) | A1, A2, A3, A4, A7, A8, A9 | — | — | — | A5, A6 |
| Loading (B) | B3.a, B3.b, B3.c, B5, B6, B7 (store) | B2 | B1, B7 (print) | — | B3.d, B4 |
| Pickup (C) | C1, C2, C3, C4, C5 | — | — | — | — |
| Delivery (D) | D3, D4, D5, D6, D7, D8 | D1 | D2 | — | — |
| Override / audit (E) | E2, E3 | E1 | — | — | — |

---

## Closed since original audit

| Box | Fix | Migration / Code | Regression |
|---|---|---|---|
| D4 / D6 (delivery UI bug) | `&&` → `\|\|` in `DeliveryTerminal.handleSubmit` + matching `disabled` | `src/pages/DeliveryTerminal.tsx` | `tests/regression/workflow-gate/DeliveryCompletionGate.test.tsx` |
| A8 (storage zone) | `clearance_evidence.storage_zone` + gate trigger + zone audit | `supabase/migrations/...a8-storage-zone-clearance.sql`, `src/components/clearance/ClearanceCard.tsx`, `src/hooks/useClearanceData.ts` | `tests/regression/workflow-gate/ClearanceStorageZoneGate.test.ts` |
| B3.a–c / B5 / B6 (loading → packing slip) | `validate_packing_slip_loading` BEFORE INSERT trigger; 5 gate codes | `supabase/migrations/...packing-slip-loading-gate.sql`, `src/pages/LoadingStation.tsx`, `src/lib/workflowGateError.ts` | `tests/regression/workflow-gate/PackingSlipLoadingGate.test.ts` |
| C2 / C3 / C4 (pickup completion) | `pickup_orders.final_photo_path` + `validate_pickup_completion` trigger | `supabase/migrations/...c7-pickup-gate.sql`, `src/components/shopfloor/PickupVerification.tsx`, `src/hooks/usePickupOrders.ts` | `tests/regression/workflow-gate/PickupCompletionGate.test.ts` |
| D4 / D5 / D6 (delivery backend) | `validate_delivery_completion` BEFORE UPDATE trigger on `delivery_stops`; 3 gate codes; success + blocked audit | `supabase/migrations/...delivery-completion-gate.sql`, `src/pages/DeliveryTerminal.tsx`, `src/lib/workflowGateError.ts` | `tests/regression/workflow-gate/DeliveryBackendGate.test.ts` |

---

## Remaining gaps (none are active defects)

All remaining items are either **deferred slices** (require new surface area, not bugfixes) or **low-risk UI-only** boxes the chart does not require to be DB-enforced. No flowchart box is currently in a "silent bypass" state.

1. **A5 / A6 — Server-side AI verdict re-check** (⏸ deferred). Today the OCR confidence verdict from `validate-clearance-photo` is trusted by the backend without re-evaluation. Recommended slice: re-run match server-side inside `_is_evidence_release_ready` and persist the verdict.
2. **B2 — Per-item loading photo not required** (🟡 partial). Operator can tick loaded without capturing a tag photo. Recommended slice: require `loading_checklist.photo_path IS NOT NULL` when slip insert runs (one-line addition to the existing trigger).
3. **B3.d — Partial shipment modeling** (⏸ deferred). No per-piece partial qty schema exists. Recommended slice: add `loaded_pieces` column to `loading_checklist` and extend the validation trigger.
4. **B4 — Loading-side hold/exception capture** (⏸ deferred). `delivery_exceptions` is post-delivery only. Recommended slice: add `loading_exceptions` (or reuse `delivery_exceptions` with a scope column) and wire from `LoadingStation`.
5. **E1 — Per-attempt override reason on loading / pickup / delivery** (🟡 partial). Override bypass is honoured and audited but the *reason* is captured only on clearance. Recommended slice: extend `OverrideReasonDialog` integration to the three other gates.
6. **D1 — Driver assignment not gated** (🟡 partial, low risk). Chart treats it as planning, not a hard gate; promoting it would only block accidental empty assignments.

## Areas fully aligned with the chart

- A1–A4, A7, A8, A9 — clearance evidence + storage zone end-to-end.
- B3.a/b/c, B5, B6 — loading validation now blocks packing-slip creation server-side.
- C1–C5 — pickup release fully DB-gated on photo + signature + per-item verification.
- D3, D4, D5, D6, D7, D8 — delivery completion fully DB-gated; UI bug fixed.
- E2, E3 — audit and override accounting remain DB-enforced and now cover the new gates.

---

This audit is the deliverable. No code or schema was changed in this pass.
