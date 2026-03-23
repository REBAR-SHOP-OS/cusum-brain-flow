

## Fix: Straight Bar Dimensions Appearing in Column A Instead of B

### Root Cause

**Location**: `supabase/functions/manage-extract/index.ts`, `applyMapping()` function (lines 362-456).

**Problem**: The mapping/normalization layer has **no shape-aware dimension logic**. The AI extraction prompt tells Gemini to extract dimension values exactly as they appear in the source document. When a source document has a straight bar's length in column A (common in many bar schedules), the AI correctly maps it to `dim_a`. But per rebar industry convention, straight bars (no shape code = STR) should have their straight length in dimension `B`, not `A`.

**Bug type**: Normalization bug — not parser, not renderer, not conversion.

The renderer (`AIExtractView.tsx` lines 2105-2116) faithfully displays whatever is in `dim_a`, `dim_b`, etc. The parser (`extract-manifest`) faithfully extracts what the AI returns. The missing piece is a normalization rule in `applyMapping()` that enforces the business rule for straight bars.

### Smallest Safe Patch

**File**: `supabase/functions/manage-extract/index.ts`

**Change**: In the `applyMapping()` function, after unit conversion is applied to all dimensions (after line ~398), add a straight-bar normalization block:

```
For each row where shape_type is null/empty AND shape_code_mapped is null/empty (i.e., STR):
  - If dim_a has a value AND dim_b is null/empty:
    - Move dim_a value → dim_b
    - Clear dim_a
  - If dim_a has a value AND dim_b also has a value:
    - Leave both as-is (source explicitly provided both)
```

This runs **after** unit conversion, so values are already in mm. It only affects rows that are genuinely straight bars (no shape code). It preserves any explicit B values from the source.

### What Remains Unchanged

- AI extraction prompt (no change)
- Renderer in AIExtractView.tsx (no change)
- Unit conversion logic (no change)
- Non-straight bar rows (untouched — the block only fires when shape is empty/null)
- Database schema (no change)
- All other edge functions (no change)
- Existing mapped sessions — already-approved data is not retroactively changed; only future `applyMapping` calls apply the rule

### Regression Risk

**Low**. The normalization only fires for rows with no shape type and only moves `dim_a → dim_b` when B is empty. Bent bars always have a shape type/code so they are excluded. If a source document explicitly provides both A and B for a straight bar, both are preserved.

### Validation

After patch:
- STR rows with length in A (and no B) → length moves to B
- STR rows with explicit A and B → both preserved
- Type 17 rows with A/B/C → completely unchanged (shape_type is "17")
- Type 2 rows with A/B → completely unchanged
- mm/in toggle still works (normalization runs after conversion)

### Rollback

Revert the single block addition in `manage-extract/index.ts`. Already-mapped sessions are unaffected unless re-mapped.

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/manage-extract/index.ts` | Add ~15-line straight-bar dim normalization block in `applyMapping()` | Safe additive |

