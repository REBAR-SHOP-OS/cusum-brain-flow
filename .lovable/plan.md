
## Problem

In `src/hooks/useAutoClearance.ts`, Auto Clearance can advance to product capture even when the tag photo did not actually persist on the evidence row.

Root causes found in code:

1. **Tag-pick path skips the tag upload entirely.** `confirmPick()` (line 381) only updates `verification_state = 'tag_scanned'` but never uploads the captured tag blob. The blob from `handleTagCapture` is dropped, so `tag_scan_url` stays NULL while the UI moves to `waiting_product`.
2. **High-confidence path advances on React state only.** After `tagUpErr` check it `setState("tag_matched")` then `setTimeout → waiting_product`. There is no re-read of the row to confirm `tag_scan_url` is actually present before unlocking product capture.
3. **`handleProductCapture` does not re-verify the evidence row.** It uses cached `activeEvidenceId` and fires product upload + validation in parallel. If the tag row update silently failed (RLS, network), product photo still gets written.
4. **UI gating is weak.** `AutoClearanceMode.tsx` line 47 computes `stage` from local state only and lets the shutter fire as soon as `state === 'tag_matched'`. The shutter button is not bound to "tag photo confirmed on DB".
5. **Offline drain** re-feeds queued product captures without checking that the matching evidence row has `tag_scan_url`.

## Fix

All edits are frontend-only. No DB schema changes, no RLS bypass, no new evidence rows.

### 1. `src/hooks/useAutoClearance.ts` — strict state machine

Replace the loose `AutoState` union with the explicit sequence:

```
waiting_tag → tag_uploading → ocr_running → matching →
tag_evidence_saved → waiting_product → product_uploading →
product_validating → completed → (waiting_tag | manifest_complete)
tag_pick (medium confidence branch, must still upload tag before waiting_product)
```

Add a single helper `assertTagEvidenceReady(evidenceId, itemId)` that:

- `SELECT id, cut_plan_item_id, tag_scan_url, verification_state FROM clearance_evidence WHERE id = evidenceId`
- Throws `"Tag photo required before product photo"` if `tag_scan_url` is null/empty.
- Throws if `cut_plan_item_id !== itemId`.
- Throws if `verification_state` not in (`tag_scanned`, `product_captured`, `complete`).

Use this helper in two places:

- End of `handleTagCapture` (both high-confidence and confirm-pick branches): only call `setState("waiting_product")` after this helper resolves.
- Start of `handleProductCapture`: run it before any upload. On failure: `setState("waiting_tag")`, clear `activeEvidenceId`/`activeItemId`, show banner "Tag photo required before product photo."

### 2. Fix the tag-pick branch

In `handleTagCapture`, when `decision === "confirm"`:

- Keep the captured `blob` in a ref (`pendingTagBlobRef`) before showing the picker.
- In `confirmPick(candidateId)`:
  1. `ensureEvidenceRow(candidateId)`
  2. `uploadToStorage(candidateId, "tag", pendingTagBlobRef.current)`
  3. UPDATE the row with `tag_scan_url`, `verification_state='tag_scanned'`, method `'assisted'`, ocr/confidence.
  4. `assertTagEvidenceReady` → only then `setState("waiting_product")` and set `activeEvidenceId`.
- If the blob is missing (drain path / refresh), do not advance; return to `waiting_tag`.

### 3. High-confidence branch sequencing

Keep parallel `Promise.all([ensureEvidenceRow, uploadToStorage])` but make the state transition strictly:

```
setState("tag_uploading")
await Promise.all([ensureEvidenceRow, uploadToStorage])
setState("ocr_running") // already done above, just relabel for clarity
await update({ tag_scan_url, verification_state:'tag_scanned', ... })
await assertTagEvidenceReady(evId, matchedItem.id)
setActiveEvidenceId(evId)
setState("tag_evidence_saved")
setState("waiting_product")
```

Remove the 250 ms `setTimeout` to `waiting_product` — go directly after the assert resolves so the UI cannot fire a product shutter while the row write is still in flight.

### 4. Product capture gate

In `handleProductCapture`:

1. Guard: if `!activeItemId || !activeEvidenceId` → banner "Scan and save tag first." and return without changing state.
2. `await assertTagEvidenceReady(activeEvidenceId, activeItemId)`. On failure → banner, reset to `waiting_tag`, clear actives, return.
3. Then upload + validate as today, but stop running the row update in parallel with validation only after the gate passes. Keep the existing "do not create a second row" behavior (already uses `activeEvidenceId`).
4. `finalizeVerification` already re-reads both photos — keep as is. Add explicit check that `cut_plan_item_id` on the row equals `itemId`.

### 5. UI gating in `AutoClearanceMode.tsx`

- Replace the inline `stage` computation with a derived value driven by the new state:
  - `stage = (state === 'waiting_product' || state === 'product_uploading' || state === 'product_validating') ? 'product' : 'tag'`.
  - `tag_evidence_saved` belongs to `tag` stage until React flips to `waiting_product`.
- Pass a `productLocked` prop to `AutoCameraStream` derived from `!(activeEvidenceId && state === 'waiting_product')`. When locked in product mode, the shutter button is disabled and shows the message "Scan and save tag first."
- Show a small tag-photo thumbnail (signed URL of `tag_scan_url`) in the HUD as soon as `state === 'waiting_product'` so the operator has visual confirmation the tag was saved.

### 6. Offline drain safety

In `drainQueue`, for `kind === 'product'`:

- Look up the evidence row by `cut_plan_item_id = cap.itemId`. If `tag_scan_url` is null, leave the capture queued and skip (don't write a product photo to an unconfirmed row).

### 7. Manual Verify path

`ClearanceCard.tsx` Manual Verify uses its own evidence flow (already enforces both photos in `finalizeVerification`). Add the same `assertTagEvidenceReady` re-read just before flipping `cut_plan_items.phase` to `cleared`, so manual and auto share one DB-confirmation helper. Extract the helper into `src/lib/clearanceEvidenceGate.ts` and import from both.

## Files touched

- `src/hooks/useAutoClearance.ts` — state machine, gate helper calls, confirmPick upload, drain safety.
- `src/components/clearance/AutoClearanceMode.tsx` — stage derivation, product shutter lock, tag thumbnail.
- `src/components/clearance/AutoCameraStream.tsx` — accept `productLocked` / disabled-reason message on shutter.
- `src/components/clearance/ClearanceCard.tsx` — call shared gate helper before final clear.
- `src/lib/clearanceEvidenceGate.ts` *(new)* — `assertTagEvidenceReady(evidenceId, itemId)`.
- `tests/regression/workflow-gate/auto-clearance-tag-gate.test.ts` *(new)* — unit test: confirmPick without tag upload throws; product capture without `tag_scan_url` is rejected; drain skips orphan product.

## Non-goals

- No DB migration. The existing `clearance_evidence.tag_scan_url` column and `auto_advance` trigger are unchanged.
- No change to `validate-clearance-photo` edge function.
- No new evidence row paths — all writes still go through `ensureEvidenceRow` + `activeEvidenceId`.
