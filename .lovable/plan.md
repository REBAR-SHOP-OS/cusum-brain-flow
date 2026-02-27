

## Populate Missing "Type" and "DW#" Columns in Packing Slips

### Problem
The packing slip "Type" column is always empty, and "DW#" is missing from the stored data. The `asa_shape_code` field is saved in `items_json` but never rendered. The `drawing_ref` field exists on `CompletedBundleItem` but is not included when building `items_json`.

### Changes

**1. `src/pages/LoadingStation.tsx` (~line 123-130) — Include `drawing_ref` in items_json**
- Add `drawing_ref: item.drawing_ref` to the `itemsJson` mapping so it gets persisted to the packing slip

**2. `src/components/delivery/PackingSlipPreview.tsx` — Render Type column + add field to interface**
- Add `asa_shape_code?: string` to the `ChecklistItem` interface
- Render `item.asa_shape_code || ""` in the Type `<td>` (line ~170, the empty `<td>`)
- Do the same in the email HTML builder (`buildSlipHtml`) — replace the empty Type `<td>` with `${it.asa_shape_code || ""}`

**3. `src/pages/DeliveryTerminal.tsx` (~line 14-20) — Add field to interface**
- Add `asa_shape_code?: string` to the local `ChecklistItem` interface (data already flows from `items_json`)

**4. `src/components/accounting/documents/PackingSlipTemplate.tsx` — No changes needed**
- Already has a `type` field that renders; this is a separate template used from accounting

### Scope
- 3 files modified, no database or schema changes
- Existing deliveries missing `drawing_ref` will show blank DW# (data wasn't stored); new deliveries will be complete

