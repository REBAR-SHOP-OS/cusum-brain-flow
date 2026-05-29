# Flowchart Compliance Audit
**Date:** 2026-05-29 · **Scope:** Approved operational flowchart (Clearance → Loading → Pickup / Delivery) + Persian workflow business rules · **Mode:** Audit only, no implementation.

Sources of truth, in order:
1. The approved boxed flowchart provided by the user.
2. The Persian operational workflow description (business-rule precedence over the chart when in conflict — explicitly noted below).

Legend: ✅ Backend-enforced · 🟦 UI-only · 🟡 Partially implemented · 🔴 Missing.

---

## A. Clearance branch

| # | Flowchart box / business rule | Status | Evidence in code |
|---|---|---|---|
| A1 | Fabrication completed → enters clearance | ✅ | DB trigger `auto_advance_item_phase` + `validate_cut_plan_item_transition` enforces `bent/cut_done → clearance` and requires `bend_completed_pieces ≥ total_pieces`. |
| A2 | Clearance started | ✅ | `clearance_evidence` row created with `verification_state` lifecycle. |
| A3 | **Tag photo before product photo** (Persian rule: hard order) | ✅ | `src/lib/clearanceEvidenceGate.ts → assertTagEvidenceReady` blocks product capture until `tag_scan_url` exists on the same evidence row. Used by `useAutoClearance` and `ClearanceCard` Manual Verify. |
| A4 | Product photo blocked until tag validation succeeds | ✅ | Same gate plus `verification_state ∈ {tag_scanned, product_captured, complete}` check. |
| A5 | AI matching (OCR, tag validation, product validation) | 🟡 | `validate-clearance-photo` edge function returns `confidence` (`high/low/unreadable`). Frontend acts on it (auto-advance vs. manual review), but the **AI verdict itself is not a backend gate** — `validate_cut_plan_item_transition` only checks that both photos exist and `_is_evidence_release_ready(...)` flags the row as valid; it does not re-check OCR similarity server-side. |
| A6 | AI confident (>95%) → auto approve | 🟡 | UI applies the threshold; backend accepts any valid evidence row. |
| A7 | Low confidence / failed match → manual review | ✅ (UI) + ✅ (audit) | Manual Verify path now writes `override_reason` + `activity_events { source='manual_verify' }` audit row via `trg_log_clearance_verify_audit`. |
| A8 | **Assign storage zone (Zone 1–5)** | 🔴 | No `storage_zones` table, no `zone_id` column on `clearance_evidence` / `cut_plan_items`, no UI prompt. The chart explicitly requires this step before "Clearance completed"; today the item flips `cleared → zoned → loading` but the `zoned` state is **transitional only** with no zone reference captured. |
| A9 | Clearance completed → ready for loading | ✅ | `cleared` → `loading` adjacency in trigger; auto-bridge `cleared → complete` is a fast-path that **skips the zoning step** (consistent with A8 gap). |

**Override / audit cross-cut:** ✅ `override_reason` column + `_workflow_override_active()` PG helper + `OverrideReasonDialog` + audit triggers `trg_log_clearance_verify_audit` and `trg_log_cut_plan_item_phase_transition` cover all phase changes including manual overrides.

---

## B. Loading branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| B1 | Loading started | 🟦 | `LoadingStation.tsx` is opened by user selecting a "completed bundle"; no explicit "loading_started" persisted state at the bundle level. `loading_checklist` rows are lazily initialized. |
| B2 | **Scan / photo each tag during loading** | 🟡 | Per-item photo capture exists (`LoadingItemCard` + `uploadPhoto`); also AI auto-match via `match-tag-photo` edge function. **Not required**: a user can tick an item loaded without taking any photo. |
| B3.a | Loading validation — **missing items** | 🟡 | `allLoaded = loadedCount === totalItems` is checkbox-based. There is no server-side check that every `cut_plan_items.phase='complete'` row has a corresponding `loading_checklist.loaded=true` row before downstream actions. |
| B3.b | Loading validation — **wrong items** | 🔴 | No detection. AI match is advisory; manual checklist accepts any tick. No comparison of scanned tag mark vs. expected mark beyond the in-flight match suggestion. |
| B3.c | Loading validation — **duplicate items** | 🔴 | No dedupe rule; same item can be marked loaded multiple times via auto-match overwrites (last write wins on `photo_path`). |
| B3.d | Loading validation — **partial shipment** | 🔴 | No partial-shipment concept on `loading_checklist`. `allLoaded` is binary. |
| B4 | **Hold loading / exception found → manual review** | 🔴 (data layer exists, not wired here) | `delivery_exceptions` table from #3 exists but **is not written from the loading flow** — only post-delivery. No "hold" state on `loading_checklist` or `deliveries`. |
| B5 | Valid load → generate packing slip | 🟡 | `createDelivery` triggers only on `allLoaded`. Gate is **count of checkboxes only** — no requirement that B3.a–d passed, no requirement that each line has a photo. Slip is inserted with `status='draft'`. |
| B6 | **Packing slip cannot be generated before validation passes** | 🔴 | Gate is the checkbox count only; no FK / trigger blocks insert into `packing_slips` when validation is incomplete. |
| B7 | Store digital packing slip + print customer copy | ✅ (store) / 🟦 (print) | Row inserted in `packing_slips` with `items_json`, ship_to, invoice_number, etc. Print is a UI-level PDF preview in `PackingSlipPreview.tsx`. |

---

## C. Pickup branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| C1 | Pickup selected | ✅ | `pickup_orders` + `pickup_order_items` tables + `PickupStation.tsx`. Phase adjacency: `loaded → ready_for_pickup → picked_up`. |
| C2 | **Take final load photo** (Persian rule explicit) | 🔴 | `PickupVerification.tsx` has signature + per-item verified, **no final-photo capture**. `pickup_orders.signature_data` exists; no `final_photo_url` column. |
| C3 | **Item-by-item confirmation** | 🟦 | `allVerified = items.every(i => i.verified)` is a frontend-only gate. No DB constraint or trigger enforces it before `authorizeRelease`. |
| C4 | **Customer signature** | 🟦 + ✅ persisted | `SignaturePad` captures → blob storage → `pickup_orders.signature_data` path. The release button is gated on `signature && allVerified`, but only at the UI layer. No DB NOT NULL / trigger on `signature_data` when status flips to released. |
| C5 | Pickup completed → status closed | ✅ | Phase trigger `picked_up → complete/closed` allowed. |

---

## D. Delivery branch

| # | Flowchart box / business rule | Status | Evidence |
|---|---|---|---|
| D1 | Assign driver, send tablet data | 🟡 | `deliveries.driver_name`, `driver_profile_id` columns exist; assignment surfaced in `DeliveryPipeline` label ("Driver: Unassigned"). No backend requirement that a driver be assigned before `phase=driver_assigned`. |
| D2 | Driver receives packing slip / address / GPS | 🟦 | `DeliveryTerminal.tsx` shows address + Google Maps link. Packing slip read from `packing_slips` linked by `delivery_id`. |
| D3 | Delivery on-site | ✅ (state) | Phase adjacency `driver_assigned → in_transit → delivered` enforced. |
| D4 | **Final photo on delivery** | 🟡 — **bug** | `pod_photo_url` column exists. Submit gate in `DeliveryTerminal.handleSubmit` is `if (!photoFile && !signatureData)` → blocks only when **both** are missing. Per the chart, photo **and** signature are required; current check is logical-OR, not AND. |
| D5 | **Item-by-item delivery checklist** | 🟡 | UI walks `items` and counts ticked; result stored as a JSON string in `delivery_stops.notes`. **Not enforced** — submit succeeds with 0 items checked. No per-item rows in a confirmation table. |
| D6 | **Customer signature on delivery** | 🟡 — same bug as D4 | `pod_signature` column exists; UI captures via `SignaturePad`; gate fails because of the `&&` bug above. |
| D7 | Delivery exceptions (hold / reject / failure) | ✅ | `delivery_exceptions` table + audit trigger added in #3. Badge shown in `DeliveryPipeline`. Open-exception capture UI not yet built but data layer is enforced. |
| D8 | Delivery completed → status closed | ✅ | Phase trigger `delivered → complete/closed`. |

---

## E. Supervisor override + audit (cross-cut)

| # | Rule | Status | Evidence |
|---|---|---|---|
| E1 | Override requires explicit reason | ✅ (clearance) / 🟡 (loading/delivery) | `clearance_evidence.override_reason` exists and `OverrideReasonDialog` captures it; no override_reason capture on the loading or delivery side. |
| E2 | Every override/transition produces an audit row | ✅ | `trg_log_clearance_verify_audit` (clearance), `trg_log_cut_plan_item_phase_transition` (all phase changes), `trg_log_delivery_exception_audit` (delivery exceptions) all write `activity_events`. |
| E3 | Phase guards cannot be silently bypassed | ✅ | `_workflow_override_active()` is the single bypass switch; its use is recorded in the audit metadata (`override_active: true`). |

---

## Summary scoreboard

| Section | Fully enforced (✅) | Partial (🟡) | UI-only (🟦) | Missing (🔴) |
|---|---|---|---|---|
| Clearance (A) | A1, A2, A3, A4, A7, A9 | A5, A6 | — | **A8 (storage zone)** |
| Loading (B) | — | B2, B3.a, B5, B7 (store) | B1, B7 (print) | **B3.b, B3.c, B3.d, B4, B6** |
| Pickup (C) | C1, C5 | — | C3, C4 (gate only) | **C2 (final photo)** |
| Delivery (D) | D3, D7, D8 | D1, D4, D5, D6 | D2 | — |
| Override / audit (E) | E2, E3 | E1 | — | — |

---

## Top conflicts between approved flowchart and current implementation

These are blockers if you intend to claim the flowchart is enforced:

1. **A8 — Storage zone assignment is absent.** The chart requires Zone 1–5 selection between "manual review/auto approve" and "clearance completed". No table, no column, no UI. Currently the `zoned` phase is a transient label with no zone reference.
2. **B3 / B6 — Loading validation does not gate packing slip.** The chart requires AI loading validation to pass (missing/wrong/partial detection) before "Generate Packing Slip". Today the only gate is the operator's checkbox count, and there is no detection of wrong or duplicate scans.
3. **B4 — Hold-loading state does not exist on the loading side.** `delivery_exceptions` only covers post-delivery exceptions.
4. **C2 — Final load photo on pickup is missing entirely.** The chart and the Persian description both call for it before customer signature.
5. **D4 / D6 — Delivery completion gate is a logical bug.** `if (!photoFile && !signatureData)` accepts a submission with only one of the two; should be `if (!photoFile || !signatureData)`. This is the single highest-severity defect in the report because it silently weakens the strongest part of the flow.
6. **C3 / C4 / D5 — Item-by-item confirmation and signature are UI-only.** No DB NOT NULL / trigger / constraint prevents releasing a pickup or closing a delivery without them; a direct API call would succeed.

## Areas already aligned with the chart

- A1–A4, A7, A9 (clearance evidence pipeline, including tag-before-product order).
- E2, E3 (audit + override accounting) — strong and DB-enforced.
- D3, D7, D8 (phase transitions through delivery and exception capture).

## Recommended ordering when implementation resumes

The chart-vs-implementation gaps cluster into three slices, smallest first:

1. **Quick correctness fixes (hours):** D4/D6 AND-vs-OR bug; tighten `disabled` and the toast logic in `DeliveryTerminal`.
2. **Backend gates for existing UI-only checks (1–2 days):** promote C3/C4/D5 to triggers on `pickup_orders` and `delivery_stops`; require `signature_data` and the verified-count before status moves.
3. **New surface area (chart parity, ≥1 week each):** A8 storage zones; B3/B4/B6 loading validation engine and hold state; C2 final-load photo.

This audit is the deliverable for the current message. No code or schema was changed.
