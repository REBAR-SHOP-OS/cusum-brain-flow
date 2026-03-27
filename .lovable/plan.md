

# Fix: Import Values Must Match Original + Unit Toggle Must Work

## Root Cause Analysis

Traced the full data flow across 3 files. The bug is a 3-part chain:

### Bug 1: Imperial detection misses standalone inch values
`extract-manifest/index.ts` line 475 only detects `X'-Y"` patterns. The XLSX has `54"` and `57"` (standalone inches). The regex fails → `unit_system` is set to `"metric"` → the mapping panel defaults to "Millimeters".

### Bug 2: `parseDimension` strips `"` without flagging the unit  
`parseDimension("54"")` returns `54` as a raw number. The `"` is gone. So the DB stores `total_length_mm = 54` — but 54 is inches, not mm. The real value should be `54 × 25.4 = 1372 mm`.

### Bug 3: Preview table applies wrong conversion
`BarlistMappingPanel.tsx` calls `formatLengthByMode(54, "mm")` → shows "54 mm". But 54 is inches. If user toggles to "in", `formatLengthByMode(54, "in")` treats 54 as mm → shows "2.13 in". Both are wrong.

The LINE ITEMS table has the same bug — values never got converted to mm, so every unit toggle produces garbage.

## Fixes

### 1. `supabase/functions/extract-manifest/index.ts` — Better imperial detection

Expand the detection pattern (line 475-478) to also catch standalone inch values (`54"`, `16"`):

```typescript
// Before: only matches X'-Y"
const imperialPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]/;

// After: also matches standalone inches like 54" or 6"
const imperialPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]|^\d+(?:\.\d+)?\s*["""]\s*$/m;
```

Also scan the raw cell strings from the spreadsheet (before `parseDimension` strips the `"`). Add a secondary check using the raw XLSX values to detect `"` suffixes:

```typescript
// Check raw sheet cells for inch marks
if (isSpreadsheet && parsedWorkbook && detectedUnitSystem === "metric") {
  const sheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const sampleCells: string[] = [];
  for (const row of rawRows.slice(0, 15)) {
    for (const cell of (row as any[])) {
      if (typeof cell === "string") sampleCells.push(cell);
    }
  }
  if (sampleCells.some(c => /^\d+(?:\.\d+)?\s*[""]$/.test(c.trim()))) {
    detectedUnitSystem = "in";
  }
}
```

When `detectedUnitSystem = "in"`, the session stores `unit_system = "in"` → the mapping panel auto-selects "Inches" → `applyMapping` converts `54 × 25.4 = 1372 mm`.

### 2. `src/components/office/BarlistMappingPanel.tsx` — Preview shows raw values

The preview table should show raw (unconverted) values with the source unit label — NOT run `formatLengthByMode` which assumes mm-base. Before `applyMapping` runs, the DB values are in the SOURCE unit.

**Change line 366**: Show raw number + unit label instead of formatting from mm:
```typescript
// Before (wrong: treats raw value as mm):
formatLengthByMode(row.length, lengthUnit as LengthDisplayMode)

// After (correct: show raw value as-is with source unit):
String(row.length)
```

Same for dims on line 371:
```typescript
// Before:
formatLengthByMode(v, lengthUnit as LengthDisplayMode)

// After:
String(v)
```

The unit label in the header already shows the selected source unit — this is correct. The numbers just need to be raw.

### 3. `src/components/office/AIExtractView.tsx` — LINE ITEMS table uses correct display

After `applyMapping`, values in `total_length_mm` and `dim_*` are genuinely in mm. The unit toggle should work correctly with `formatLengthByMode` at that point. BUT if the user is viewing BEFORE mapping (status = "extracted"), values are still raw.

Add a guard: if session status is before "mapped", display raw values; if after "mapped", use `formatLengthByMode`:

```typescript
const valuesAreInMm = ["mapped", "validated", "approved"].includes(activeSession?.status);
// In the table cell:
valuesAreInMm 
  ? formatLengthByMode(row.total_length_mm, selectedUnitSystem as LengthDisplayMode)
  : String(row.total_length_mm ?? "")
```

## Summary of Changes

| File | What |
|------|------|
| `supabase/functions/extract-manifest/index.ts` | Detect standalone `"` in raw XLSX cells → auto-set `unit_system = "in"` |
| `src/components/office/BarlistMappingPanel.tsx` | Preview shows raw values (not mm-converted) |
| `src/components/office/AIExtractView.tsx` | LINE ITEMS: only apply `formatLengthByMode` after mapping converts to mm |

