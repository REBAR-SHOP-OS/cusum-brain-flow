

# Show Original Source Values in Tags & Export and Detailed List

## Problem
The AI Extract view correctly shows source values (e.g., `6'6"`, `4'`) using `source_total_length_text` and `source_dims_json` columns. But the **Tags & Export** view and **Detailed List** view still read from the converted `total_length_mm` / `dim_*` columns and apply `formatDim()`, producing wrong values like `78 MM` and `48 MM`.

Two affected paths:
1. **TagsExportView.tsx** — reads `extract_rows` but uses `formatDim(row.total_length_mm)` and `formatDim(dim_*)` instead of source text
2. **DetailedListView.tsx** — reads `cut_plan_items.cut_length_mm`, which is copied from `extract_rows.total_length_mm` during approval — source text is lost entirely
3. **RebarTagCard.tsx** — receives `length` as mm number, formats with `formatVal`

## Fix

### 1. TagsExportView.tsx — Use source text fields
- For LENGTH column: display `row.source_total_length_text` when available, fall back to `formatDim(row.total_length_mm)`
- For DIM columns: display `row.source_dims_json[col]` when available, fall back to `formatDim(dim_val)`
- Remove the forced `(mm)` / `(in)` unit label from the header when source text is used (since values may mix units)
- Apply same logic in CSV export

### 2. RebarTagCard.tsx — Accept source text props
- Add optional `sourceLength?: string` and `sourceDims?: Record<string, string>` props
- When present, display these instead of `formatVal(length)` / `formatDim(dim)`
- TagsExportView passes these from `row.source_total_length_text` and `row.source_dims_json`

### 3. DetailedListView.tsx — Propagate source text from cut_plan_items
- Add `source_total_length_text` and `source_dims_json` columns to `cut_plan_items` table via migration
- Update the approve action in `manage-extract` to copy these fields when creating cut_plan_items
- In the view, display source text when available

### 4. manage-extract approve action
- Copy `source_total_length_text` and `source_dims_json` from `extract_rows` into `cut_plan_items` during the approve step

## Scope
- 3 UI files: `TagsExportView.tsx`, `RebarTagCard.tsx`, `DetailedListView.tsx`
- 1 edge function: `manage-extract/index.ts` (approve action)
- 1 DB migration: add source text columns to `cut_plan_items`

