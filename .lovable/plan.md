

# Fix Missing LENGTH and DIMS in Extract Line Items

## Problem
After extracting an imperial (ft-in) XLSX file, **all LENGTH and DIMS columns show "—"** (empty). The mapping panel warning confirms: "Cut Length (mm): all values empty".

Two root causes:

1. **`overlaySheetDims` ignores `total_length`** — it deterministically reads dimension columns A–R from the XLSX but does NOT read the "Cut Length" / "Total Length" column. When the AI fails to parse imperial values, there's no fallback.

2. **AI returns null for imperial ft-in values** — the prompt says `"total_length": number in mm` but the source contains `3'-5"` style values. The AI either can't convert or returns nulls. Similarly for dimensions.

## Solution

### File: `supabase/functions/extract-manifest/index.ts`

#### Change 1: Extend `overlaySheetDims` to also overlay `total_length`

Add header matching for "Cut Length", "Total Length", "Length", "CutLength", "TOTAL LENGTH" etc. in the same header row scan. When found, read the column value for each item and assign it as `total_length` using `parseDimension()` (which already handles ft-in strings like `3'-5"`).

```text
Current overlaySheetDims flow:
  Find header row → map dim columns (A-R) → overlay values

New flow:
  Find header row → map dim columns (A-R) AND length column → overlay all values
```

Specifically, in the `hRow.forEach` loop (~line 80-83), also check for length-related headers:
```ts
const normalized = String(c).trim().toUpperCase()
  .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
if (["CUT LENGTH", "TOTAL LENGTH", "LENGTH", "CUTLENGTH"].includes(normalized)) {
  colMap["__LENGTH__"] = i;
}
```

Then in the items mapping loop (~line 87-97), add:
```ts
if (colMap["__LENGTH__"] != null) {
  const raw = row[colMap["__LENGTH__"]];
  const parsed = raw != null ? parseDimension(raw) : null;
  if (parsed != null) it.total_length = parsed;
}
```

#### Change 2: Fix AI prompt for imperial data

When the session's `unit_system` is known to be imperial (from the upload step), adjust the prompt to say:
```
"total_length": number — keep the original value as-is from the document (do NOT convert units)
```

Instead of `"total_length": number in mm` which confuses the AI when the source is imperial.

#### Change 3: Post-AI fallback parse for string values

After AI returns items but before `overlaySheetDims`, add a pass that converts any string values in `total_length` and dimension fields using `parseDimension()`:

```ts
// Ensure AI-returned string values are parsed
items.forEach((item: any) => {
  if (typeof item.total_length === "string") {
    item.total_length = parseDimension(item.total_length);
  }
  for (const d of DIMS) {
    if (typeof item[d] === "string") {
      item[d] = parseDimension(item[d]);
    }
  }
});
```

This catches cases where the AI returns `"3'-5\""` as a string instead of a number.

## Files changed
- `supabase/functions/extract-manifest/index.ts` — extend `overlaySheetDims` to handle Cut Length column, add string-to-number parse pass, improve prompt for imperial sources

