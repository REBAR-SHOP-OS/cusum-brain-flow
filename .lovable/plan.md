

## Fix: Dimension Values Not Rounded to Integers

### Root Cause

In `supabase/functions/extract-manifest/index.ts`:
- `total_length_mm` uses `safeInt()` which calls `Math.round()` → stored as integers (1981, 3270)
- `dim_a` through `dim_r` use `parseDimension()` which returns raw floats → stored with decimals (457.2, 3016.25, 1295.4, 3479.8)

This causes the "5 LINE ITEMS" results table and Tags & Export to display fractional mm values, which is incorrect for mm-based data.

### Changes

**1. `supabase/functions/extract-manifest/index.ts`** — Round all dimensions during extraction

Change dimension storage from `parseDimension(item.X)` to `safeInt(item.X, null)` or add `Math.round()` so all dim values are stored as integers, matching `total_length_mm`.

```
dim_a: safeInt(item.A, null) || null,
dim_b: safeInt(item.B, null) || null,
// ... same for all dim columns
```

Modify `safeInt` to accept `null` as fallback (or create a `safeDim` helper that returns `null` instead of 0 for empty values).

**2. `supabase/functions/manage-extract/index.ts`** — Already uses `Math.round()` in `applyMapping`, no change needed.

**3. `src/components/office/AIExtractView.tsx`** — Round dimensions in the results table display

In the "5 LINE ITEMS" table (line ~2070), wrap the raw dimension display with `Math.round()`:
```
(row as any)[key] != null ? formatDimForDisplay(Math.round((row as any)[key]), ...) : ""
```

Also round LENGTH display (line ~2061) for consistency.

**4. `src/components/office/TagsExportView.tsx`** — Round dimensions in display and export

- In the table display (line ~392), round dimension values before `formatDim()`
- In CSV export (line ~108), round dimension values

**5. Fix existing data** — Run a one-time data update to round all existing decimal dimension values in `extract_rows` to integers. This will use an INSERT tool (UPDATE query).

### Summary
- Extraction: round dims at source (extract-manifest)
- Display: round dims at render (AIExtractView + TagsExportView)
- Edge function: already rounds (manage-extract)
- Data fix: round existing fractional values in DB

### Files
- `supabase/functions/extract-manifest/index.ts` — round dims during extraction
- `src/components/office/AIExtractView.tsx` — round dims in results table
- `src/components/office/TagsExportView.tsx` — round dims in display + export

