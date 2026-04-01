

# Map Invoice & Remark Columns to AI Extract Session Fields

## Problem
The **Invoice** column currently displays `row.reference` (per-row data) and **Remark** displays `row.address` (per-row data). The user wants these to come from the AI Extract session-level fields instead:
- **Invoice** → `selectedSession.invoice_number` (the "INVOICE NUMBER" field from the extract form)
- **Remark** → `selectedSession.name` (the "SCOPE" field from the extract form)

## Changes — `src/components/office/TagsExportView.tsx`

### 1. Table body cells (lines 448-449)
- Line 448: `row.reference` → `(selectedSession as any)?.invoice_number`
- Line 449: `row.address` → `selectedSession?.name`

### 2. CSV export data (line 133)
- Change `r.reference || ""` → `(selectedSession as any)?.invoice_number || ""`
- Change `r.address || (selectedSession as any)?.site_address || projectAddress || ""` → `selectedSession?.name || ""`

### 3. Zebra ZPL data (line 185-187)
- Update `reference` field mapping to use session `invoice_number`
- Update `remark` field mapping to use session `name`

### 4. Card view props (lines 496-498)
- Update `reference` prop to use session `invoice_number`
- Update `address` prop to use session `name`

## Impact
- 1 file changed: `TagsExportView.tsx`
- All views (table, cards, CSV, ZPL) will consistently show session-level Invoice Number and Scope
- No database or schema changes needed

