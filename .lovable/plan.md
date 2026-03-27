

# Fix: Dimension Data Shifted Left in Extract Line Items Table

## Problem
On the `/office` AI Extract page, dimension values in the line items table are shifted one column to the left — values that should appear under column B appear under A, values for C appear under B, and so on.

## Root Cause Analysis

After reading the full pipeline (`extract-manifest` → `manage-extract` → `AIExtractView.tsx`), the code is structurally correct:

- `DIM_FIELDS` / `dimCols` = `["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"]` — correctly skips "I"
- The AI prompt at line 153 explicitly sets `"I": null` and warns the AI not to shift
- Row insertion at lines 416-427 maps `item.A → dim_a`, `item.B → dim_b`, etc. correctly
- Display code reads `dim_${d.toLowerCase()}` per column — correct

**The bug is in the AI model's behavior**, not the code structure. When the AI parses a CSV/spreadsheet with sequential column headers (A, B, C, D, E, F, G, H, **I**, J, K...), it reads the data under the source "I" column and, despite instructions, shifts all subsequent values left by one position. This means:
- Source column A data → AI field A ✓
- Source column B data → AI field B ✓
- ...through H ✓
- Source column I data → AI puts it into H (shift starts)
- Source column J data → AI puts it into J but the I-column data corrupted H

**Or alternatively**: The AI drops the I column but shifts A-H left by one position entirely, placing what should be in B into A, C into B, etc.

## Fix Plan

### 1. Add deterministic XLSX dimension column parser (bypass AI for dimension extraction)
**File:** `supabase/functions/extract-manifest/index.ts`

For spreadsheet files, after XLSX parsing, detect dimension column headers deterministically:
- Scan the header row for columns matching single letters A-R (skipping I)
- Extract dimension values directly from the parsed rows using column indices
- Pass these pre-extracted dimensions to the AI as structured data, OR overlay them on top of the AI's output

This removes AI ambiguity for the most error-prone part of the extraction.

```text
Before (current):
  XLSX → CSV text → AI prompt → AI returns {A, B, C...} → store

After (proposed):  
  XLSX → CSV text → AI prompt → AI returns items
  XLSX → header scan → deterministic dim extraction → overlay dims on AI items
  → store corrected dims
```

### 2. Strengthen AI prompt with explicit column-index anchoring
**File:** `supabase/functions/extract-manifest/index.ts` (line ~174-178)

Add stronger instructions:
```
CRITICAL: When processing spreadsheet/CSV data, each column's data must map to its HEADER label exactly.
If the CSV has headers: ..., A, B, C, D, E, F, G, H, I, J, K, ...
- Column "A" value → field "A"
- Column "H" value → field "H"  
- Column "I" → SKIP entirely (set "I": null)
- Column "J" value → field "J" (NOT shifted to "I")
DO NOT shift or re-index columns. Match by header name, not by column position.
```

### 3. Add post-extraction dimension validation
**File:** `supabase/functions/extract-manifest/index.ts` (after line 433)

After AI returns items, before inserting rows, add a cross-check:
- For spreadsheet files, parse the CSV headers to identify the actual column positions
- Compare AI-returned dimension values against the raw CSV cell values
- If a systematic 1-column shift is detected, auto-correct by shifting all dims right by one position

### Implementation Details

**Primary fix (deterministic overlay):**
```typescript
// After XLSX parsing, extract dim columns deterministically
function extractDimsFromSheet(workbook: any): Map<number, Record<string, number | null>> {
  const DIM_LETTERS = new Set(["A","B","C","D","E","F","G","H","J","K","O","R"]);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find header row
  const headerRow = jsonRows.find(row => 
    row.some(cell => DIM_LETTERS.has(String(cell).trim().toUpperCase()))
  );
  if (!headerRow) return new Map();
  
  // Map column indices to dim letters
  const colMap: Record<number, string> = {};
  headerRow.forEach((cell, idx) => {
    const letter = String(cell).trim().toUpperCase();
    if (DIM_LETTERS.has(letter)) colMap[idx] = letter;
  });
  
  // Extract dim values per data row
  const result = new Map();
  const dataRows = jsonRows.slice(jsonRows.indexOf(headerRow) + 1);
  dataRows.forEach((row, idx) => {
    const dims: Record<string, number | null> = {};
    for (const [colIdx, letter] of Object.entries(colMap)) {
      dims[letter] = parseDimension(row[Number(colIdx)]);
    }
    result.set(idx, dims);
  });
  return result;
}
```

Then overlay these deterministic dims onto the AI-extracted items before DB insertion:
```typescript
if (isSpreadsheet && deterministicDims.size > 0) {
  items.forEach((item, idx) => {
    const dims = deterministicDims.get(idx);
    if (dims) {
      for (const [letter, val] of Object.entries(dims)) {
        item[letter] = val; // Override AI's potentially shifted value
      }
      item.I = null; // Always null
    }
  });
}
```

**Secondary fix (prompt strengthening):** Update prompt text as described above.

## Files to Change
- **`supabase/functions/extract-manifest/index.ts`** — add deterministic dim extraction for spreadsheets, strengthen AI prompt, add post-extraction validation

## Expected Result
- Spreadsheet dimension values are always correctly placed under their matching column headers
- AI model behavior no longer causes column shifts
- Existing non-spreadsheet (PDF/image) extractions continue to work via AI with the improved prompt

