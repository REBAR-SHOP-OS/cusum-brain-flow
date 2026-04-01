

# Fix Duplicate Rows in AI Extract

## Problem
The AI extraction produces duplicate rows when the source PDF contains the same bar data across multiple pages/tables. Two identical rows (e.g., A1003, 10M, T1, 2840, qty 2) appear because minor grade variations like "400/R" vs "400R" are treated as different entries, and the deduplication step only runs later as a manual action.

## Root Cause
The `extract-manifest` edge function inserts all AI-extracted items directly without deduplication. The existing `detectDuplicates` function in `manage-extract` runs separately and must be triggered manually.

## Solution
Add automatic deduplication in `extract-manifest` **before** inserting rows into the database.

### 1. `supabase/functions/extract-manifest/index.ts` — Add pre-insert dedup

After building the `rows` array (line ~563) and before the batch insert loop (line ~567), add a deduplication step:

- **Normalize grade**: Strip `/` and whitespace so "400/R" and "400R" produce the same key
- **Build dedupe key** per row: `mark + size + shape + length + dims` (same logic as `computeDuplicateKey` but including dimensions for precision)
- **Merge duplicates**: When two rows share the same key, keep the first occurrence and sum quantities
- This prevents duplicates from ever entering the database

```typescript
// Deduplicate rows before insert
const dedupeMap = new Map<string, typeof rows[0]>();
for (const row of rows) {
  const normGrade = (row.grade || "").replace(/[\/\s]/g, "").toLowerCase();
  const key = [
    (row.mark || "").trim().toLowerCase(),
    (row.bar_size || "").trim().toLowerCase(),
    (row.shape_type || "straight").trim().toLowerCase(),
    String(row.total_length_mm || 0),
    String(row.dim_a || 0), String(row.dim_b || 0),
    String(row.dim_c || 0), String(row.dim_d || 0),
  ].join(":");
  
  if (dedupeMap.has(key)) {
    const existing = dedupeMap.get(key)!;
    existing.quantity = (existing.quantity || 0) + (row.quantity || 0);
    // Keep the more complete grade
    if (!existing.grade && row.grade) existing.grade = row.grade;
  } else {
    row.grade = row.grade; // keep as-is
    dedupeMap.set(key, row);
  }
}
const dedupedRows = Array.from(dedupeMap.values())
  .map((r, idx) => ({ ...r, row_index: idx + 1 }));
```

Then use `dedupedRows` instead of `rows` for the batch insert.

### 2. `supabase/functions/manage-extract/index.ts` — Normalize grade in duplicate key

Update `computeDuplicateKey` (line 77) to normalize grade format so the manual dedup also catches these:

```typescript
// Add grade normalization — "400/R" and "400R" should match
const grade = (row.grade_mapped || row.grade || "").replace(/[\/\s]/g, "").toLowerCase();
```

Grade is not currently part of the key (which is correct — same bar with different grade notation is still the same bar), but adding normalization ensures future additions won't break.

## Impact
- 1 edge function modified: `extract-manifest/index.ts` (add ~20 lines of dedup logic before insert)
- 1 edge function modified: `manage-extract/index.ts` (minor grade normalization, optional)
- No database migration needed
- No frontend changes needed — fewer rows will simply appear in the preview
- Existing sessions are unaffected; re-extracting will produce clean results

