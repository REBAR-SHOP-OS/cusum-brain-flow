

# Fix: Extraction Pre-Merging Rows That Should Stay Separate

## Root Cause

The `extract-manifest` edge function (lines 567-589) has a **pre-insertion deduplication** step that merges rows sharing the same `mark + bar_size + shape_type + total_length_mm + dim_a-d` key before saving to the database.

In the original spreadsheet:
- Row 2: A1001, 10M, STRAIGHT, 8'4", qty **12**
- Row 3: A1001, 10M, STRAIGHT, 8'4", qty **28**

These are intentionally separate line items (different DWG items), but the dedup key is identical, so they get merged into one row with qty **40** during extraction — before the user ever sees them.

This is wrong because many bar lists legitimately have multiple rows with the same mark, size, shape, and length but different quantities — they represent different placements or drawing references.

There is also a **second** dedupe layer in `manage-extract/detectDuplicates` that runs post-extraction as an advisory/optional merge. That layer is fine because it's user-controlled (dry-run preview + explicit confirm). The problem is the silent, automatic pre-insertion merge.

## Fix

**File: `supabase/functions/extract-manifest/index.ts`**

Remove the automatic pre-insertion deduplication block (lines 567-589). Instead, save all extracted rows as-is and let the existing post-extraction `detect-duplicates` advisory flow handle duplicate detection with user confirmation.

Replace:
```typescript
// ── Deduplicate rows before insert ──
const dedupeMap = new Map<...>();
...
const dedupedRows = Array.from(dedupeMap.values())...
savedCount = dedupedRows.length;
```

With:
```typescript
// Save all rows as-is — deduplication is handled post-extraction
// via the advisory detect-duplicates flow with user confirmation
const dedupedRows = rows.map((r, idx) => ({ ...r, row_index: idx + 1 }));
savedCount = dedupedRows.length;
console.log(`Rows to insert: ${savedCount}`);
```

## Result
- All rows from the original spreadsheet will be preserved individually
- The existing "possible duplicates" toast and merge confirmation UI still works for cases where the user actually wants to merge
- No data loss from silent automatic merging

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/extract-manifest/index.ts` | Remove automatic pre-insertion dedup; preserve all rows |

