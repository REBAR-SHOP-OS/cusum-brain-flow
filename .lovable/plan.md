

# Fix: Unit Detection Fails Because Excel Stores Inch Values as Numbers with Format-Level `"`

## Root Cause (Corrected)

The uploaded XLSX file **does** contain `"` inch marks — but Excel stores them as **number format codes**, not as part of the cell value. For example, a cell displaying `78"` is actually:
- **Cell value**: `78` (type: number)  
- **Cell format**: `0"` or `#"` (the `"` is cosmetic formatting)

The current detection has two layers, both of which miss this:

1. **Primary check (line 468-481)**: Scans `items` values after `overlaySheetDims` has already called `parseDimension()`, which strips any string marks. But since the cell is numeric, it arrives as plain `78` even before overlay.

2. **Secondary check (line 484-501)**: Scans raw XLSX cells but only checks `typeof cell === "string"`. Since Excel stores these as **numbers**, they are skipped entirely. The `"` only exists in the cell's number format (`cell.z`), which is never inspected.

## Fix

Add a **third detection layer** that inspects the XLSX cell **number format codes** (`cell.z` in SheetJS) for inch/imperial format patterns. This runs before the existing checks and catches the most common case.

### File: `supabase/functions/extract-manifest/index.ts`

**Change 1** — Add number-format-based detection (after line 501, before the DB update at line 503):

```typescript
// Tertiary check: inspect XLSX cell number formats for inch marks (e.g. format "0\"" displays 78 as 78")
if (isSpreadsheet && parsedWorkbook && detectedUnitSystem === "metric") {
  try {
    const sheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
    const cellKeys = Object.keys(sheet).filter(k => !k.startsWith("!"));
    const inchFmtPattern = /[""]|[""]\s*$/;  // format contains literal inch mark
    const hasInchFormat = cellKeys.some(k => {
      const cell = sheet[k];
      return cell && typeof cell.z === "string" && inchFmtPattern.test(cell.z);
    });
    if (hasInchFormat) {
      detectedUnitSystem = "in";
      console.log("Detected inch unit system from XLSX cell number format codes");
    }
  } catch (e) {
    console.warn("Failed to scan XLSX number formats for unit detection:", e);
  }
}
```

**Change 2** — Also expand the secondary raw-cell check (line 489) to scan **all data rows** (not just first 15), since dimension data may start further down:

Change `(rawRows as any[][]).slice(0, 15)` → `(rawRows as any[][]).slice(0, 50)`

**Change 3** — In the secondary check, also check numeric cells that have been formatted with `w` (formatted text representation in SheetJS). Add after the string cell collection:

```typescript
// Also check formatted text representations of numeric cells
for (const row of (rawRows as any[][]).slice(0, 50)) {
  for (const cell of row) {
    if (typeof cell === "number" && cell > 0 && cell < 500) {
      // Will be caught by the number-format check above
    }
  }
}
```

Actually this is redundant since Change 1 handles it. The key fix is **Change 1**.

## Summary

| Layer | What it checks | Current | After fix |
|-------|---------------|---------|-----------|
| Primary | AI-returned item values | Strings only | No change |
| Secondary | Raw XLSX cell values | String cells, first 15 rows | String cells, first 50 rows |
| **New Tertiary** | **XLSX cell number format codes** | **Not checked** | **Checks `cell.z` for `"` patterns** |

## Impact
- 1 file changed (`supabase/functions/extract-manifest/index.ts`)
- ~12 lines added
- No database, frontend, or schema changes
- Fixes the exact scenario: Excel files where `78"` is stored as number `78` with format `0"`

