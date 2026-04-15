

## Plan: Fix Unit Converter Rounding Artifacts in AI Extract

### Problem
When toggling the display unit (e.g., from inches → mm → ft), values show rounding errors like `7.99'` instead of `8'` or `47.99"` instead of `48"`.

**Root cause**: Values are stored as `total_length_mm` (rounded integer). Converting back from rounded mm introduces precision loss: `8' → 2438.4mm → 2438 → 2438/304.8 = 7.99'`.

The raw source values exist in `raw_total_length_mm` (in source units) and `raw_dims_json`, but they're only used when `displayUnit === sessionSourceUnit`. They should also be used as the conversion base for other units.

### Solution

**File: `src/components/office/AIExtractView.tsx`** — Update `displayLength` and `displayDim` functions.

**Strategy**: When `raw_total_length_mm` exists and the session's source unit is known, convert from `raw → target` instead of `mm → target`. This eliminates the integer rounding error.

1. **`displayLength`**: When converting to a non-source unit, use `raw_total_length_mm` (in source units) and convert directly to the target unit via a new helper, instead of going through the rounded `total_length_mm`.

2. **`displayDim`**: Same approach — use `raw_dims_json` values (in source units) and convert directly to the target display unit.

3. **Add helper function** `convertRawToDisplay(rawValue, sourceUnit, targetUnit)` that converts directly between unit modes without rounding through mm.

**File: `src/lib/unitSystem.ts`** — Add `convertBetweenModes(value, fromMode, toMode)` utility.

### Example fix for `displayLength`:
```typescript
// Before (lossy): formatLengthByMode(2438, "ft") → "7.99'"
// After (lossless): convert raw 96 (inches) → ft → "8'"
```

### What does NOT change
- Database values — untouched
- Source text display in native unit — untouched
- Mapping/extraction logic — untouched
- Print/tags components — untouched (they use `source_total_length_text` already)

### Files
| File | Action |
|------|--------|
| `src/lib/unitSystem.ts` | Add `convertBetweenModes()` helper |
| `src/components/office/AIExtractView.tsx` | Update `displayLength` + `displayDim` to use raw values for cross-unit conversion |

