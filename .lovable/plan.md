## Goal

On the Clearance Station, the storage zone is selected **once per manifest (project)** and applied to every item under it — instead of being picked separately on every clearance card.

The existing backend gate (`storage_zone` required on `clearance_evidence` before `cleared`) stays exactly as-is; we just change *how* the value gets onto each evidence row.

## UX

When a manifest is open and not complete:

- A single **"Storage Zone"** selector appears in the manifest header bar (next to the `X / Y` badge and Manual/Auto toggle).
- Selecting `Zone 1–5` immediately writes that zone onto every item in this manifest (existing `clearance_evidence` rows updated; missing rows inserted with the zone).
- After selection, the header shows the active zone as a small badge (e.g. `Zone: Zone 3`) with a "Change" affordance.
- If no zone is picked yet, each card shows a compact read-only `Zone required` hint instead of its own dropdown, and `Manual Verify` stays blocked by the existing pre-gate.

The per-card zone `<Select>` and its `handleZoneChange` write path are removed from `ClearanceCard.tsx`. The card keeps showing the resolved `item.storage_zone` value (read-only) so operators still see what was assigned.

Auto Clearance mode uses the same manifest-level zone (no per-item picker there either).

## Where the change lives (frontend only)

- `src/pages/ClearanceStation.tsx`
  - Add `selectedZone` state, derived from `activeItems` (if all items share the same `storage_zone`, pre-select it; otherwise empty).
  - Render the new manifest-level `<Select>` in the manifest header row.
  - On change, call a new helper `applyZoneToManifest(items, zone)` that batches:
    - `update clearance_evidence set storage_zone = :zone where id in (existing evidence ids)`
    - `insert clearance_evidence (cut_plan_item_id, storage_zone) values …` for items with no evidence row yet
    - Invalidate `["clearance-items"]`.
- `src/components/clearance/ClearanceCard.tsx`
  - Delete the per-card zone `<Select>` block (the JSX after `{/* A8: Storage zone selector … */}`) and the `handleZoneChange` / `zoneSaving` / `STORAGE_ZONES` constants.
  - Keep the existing `handleVerify` pre-gate that blocks on missing `item.storage_zone` — unchanged.
  - Show `item.storage_zone` (when present) as a small read-only label inside the card footer so the assignment is visible.
- `src/components/clearance/AutoClearanceMode.tsx` — if it has its own zone UI, drop it the same way and rely on the manifest-level value.

## Out of scope

- No DB migration. `clearance_evidence.storage_zone` stays per row.
- No change to `validate_clearance_evidence_transition`, `log_clearance_zone_assignment`, or the `Zone 1..Zone 5` CHECK.
- No change to backend gates, RLS, or workflow triggers.
- No rename of `cut_length_mm`, no changes to Detailed List, Tags/Export, or mirror trigger.

## Risk / notes

- Items added to a manifest *after* a zone was selected won't auto-inherit the zone. The manifest header keeps the selector visible until every item has a zone, so an operator can simply re-select to backfill the new ones (cheap idempotent update).
- Existing regression test `ClearanceStorageZoneGate.test.ts` still passes — the backend contract and the frontend pre-gate `preVerifyGate({ storage_zone })` are both unchanged.

No new regression test is added; this is a pure UI relocation with no new gate or backend behavior.
