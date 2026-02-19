
# Fix: Missing "Delivery Date" Column in Tags & Export Table

## Root Cause (Confirmed via Code Investigation)

The `/office` page (`OfficePortal`) contains multiple sections. The table in question is in **Tags & Export** (`src/components/office/TagsExportView.tsx`), which renders a scrollable table with columns:

`DWG # | Item | Grade | Mark | Qty | Size | Type | Total Length | [A-R dims] | Weight | Picture | Customer | Ref | Add`

The **Delivery Date** column is entirely absent from this table.

The data source is confirmed: `ExtractSession` (already fetched and stored in `selectedSession`) has a `target_eta` field which is the delivery/target date for the manifest. All rows in a session share the same session-level `target_eta`.

## Scope

**Single file, two additions:**

| File | Change |
|------|--------|
| `src/components/office/TagsExportView.tsx` | Add "Delivery Date" `<th>` to table header + `<td>` to each row |

No other files are touched. No database changes. No schema changes. No CSV export header is changed (out of scope).

## The Fix

**File:** `src/components/office/TagsExportView.tsx`

### Change 1 — Table header (line ~273, after the "Add" `<th>`)

Currently (last column in `<thead>`):
```tsx
<th className="...">Add</th>
```

After:
```tsx
<th className="...">Add</th>
<th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Delivery Date</th>
```

### Change 2 — Table row cell (line ~318, after the `row.address` `<td>`)

Currently (last column in row):
```tsx
<td className="text-xs text-muted-foreground px-3 py-2.5">{row.address || "—"}</td>
```

After:
```tsx
<td className="text-xs text-muted-foreground px-3 py-2.5">{row.address || "—"}</td>
<td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">
  {selectedSession?.target_eta
    ? new Date(selectedSession.target_eta).toLocaleDateString()
    : "—"}
</td>
```

The `selectedSession` variable is already in scope at the row-render level (it is defined at the top of the component and is accessible throughout the JSX).

## What Is NOT Changed

- `DetailedListView.tsx` — untouched
- `ProductionQueueView.tsx` — untouched
- `PackingSlipsView.tsx` — untouched
- `AIExtractView.tsx` — untouched
- `InventoryView.tsx` — untouched
- CSV export headers — untouched (out of scope per the problem statement)
- Database / schema — untouched
- All other columns — untouched
- Card view mode — untouched (only table view is affected)
