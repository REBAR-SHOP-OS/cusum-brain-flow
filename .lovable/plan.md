

# Fix: Length/Dimension Double-Conversion Bug in Imperial (ft) Sessions

## Root Cause Analysis

The pipeline has a **double-conversion** bug when the source document uses feet:

1. **Extraction**: `parseDimension("5'")` converts 5 feet → 60 inches. Or the AI model itself converts 5ft → 1524mm. Either way, the stored `total_length_mm` raw value is already in inches or mm — not in feet.

2. **Mapping**: User selects `unit_system = "ft"` → `applyMapping` multiplies by 304.8 (ft→mm factor). But the value is already in inches/mm, causing a double conversion: `1524 * 304.8 = 464,515`.

3. **Display**: `formatLengthByMode(464515, "ft")` → `464515 / 304.8 ≈ 1524.00` — shows the original mm value as if it were feet.

**DB evidence**: Session "5' straights" (unit_system=ft) has `raw_total_length_mm=1524`, `total_length_mm=464515`. Expected: `total_length_mm=1524` (since 5ft = 1524mm).

Three sub-bugs compound the problem:

| Bug | Location | Detail |
|-----|----------|--------|
| `parseDimension` returns inches, not the raw source unit | extract-manifest | `"5'"` → 60 (inches), `"3'-6"` → 42 (inches). The value mixes with an "ft" unit label |
| Imperial detection misses feet-only patterns | extract-manifest L476 | Pattern `\d+[']-?\d+[""]` won't match `"5'"` (no inches part) |
| Secondary XLSX detection misses `'` (feet mark) | extract-manifest L493 | Pattern `["""]` matches only double-quote marks, not single-quote `'` for feet |

## Fix Plan (2 files)

### 1. `supabase/functions/extract-manifest/index.ts`

**A. Fix `parseDimension` to return raw numeric value (no unit conversion)**

Currently converts "5'" to 60 (inches). Should return 5.0 (raw feet number) so the mapping stage applies the correct conversion.

```typescript
// Feet-inches: X'-Y" → return total inches (this is correct, unit will be "in" or "imperial")
// Feet only: "5'" → return 5.0 (raw feet value, NOT converted to inches)
// This lets the mapping stage apply the correct factor based on detected unit
```

Wait — this creates inconsistency: ft-in returns inches but ft-only returns feet. Better approach:

**Make `parseDimension` consistently return inches for ALL imperial patterns**, and fix the **unit detection** to set the unit to `"in"` (not `"ft"`) when imperial strings are found. Then mapping uses 25.4 (inches→mm) which is correct: 60 × 25.4 = 1524mm ✓.

Changes:
- `parseDimension`: Keep as-is (already returns inches for imperial)
- Fix imperial detection pattern to also catch feet-only (`"5'"`, `"10'"`)
- When imperial is detected, set `detectedUnitSystem = "in"` instead of `"imperial"` when values were already converted to inches by parseDimension

Actually simplest correct approach: **`parseDimension` stays the same** (returns inches). The detection and mapping pipeline just needs to know the extraction phase already normalized to inches.

**B. Fix `imperialPattern` to detect feet-only values (line ~476)**

```typescript
// Before:
const imperialPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]|\d+(?:\.\d+)?\s*["""]\s*$/;

// After — add feet-only alternative:
const imperialPattern = /\d+\s*['']\s*-?\s*\d+\s*["""]|\d+(?:\.\d+)?\s*["""]\s*$|\d+(?:\.\d+)?\s*['']\s*$/;
```

**C. Fix secondary XLSX cell scan (line ~493) to also detect `'` (feet mark)**

```typescript
// Before:
if (sampleCells.some((c: string) => /^\d+(?:\.\d+)?\s*[""]\s*$/.test(c.trim())))

// After — also match single-quote (feet):
if (sampleCells.some((c: string) => /^\d+(?:\.\d+)?\s*[""'']/.test(c.trim())))
```

**D. When imperial detected, set unit to `"in"` since parseDimension converts to inches**

After detection at line ~478:
```typescript
// parseDimension already normalized ft-in → inches, so the effective unit is "in"
detectedUnitSystem = "in";
```

### 2. `supabase/functions/manage-extract/index.ts` — Sanity guard in `applyMapping`

Add a sanity check after computing the converted value: if converting a raw value with the declared unit would produce > 100,000 mm (~100m, far exceeding any real rebar bar), the raw value is likely already in mm. Skip conversion.

```typescript
// After line 356: updates.total_length_mm = Math.round(Number(rawLength) * lengthFactor);
// Add guard:
const converted = Math.round(Number(rawLength) * lengthFactor);
if (converted > 100000 && lengthFactor > 1) {
  // Likely already in mm — skip conversion
  console.warn(`[applyMapping] Row value ${rawLength} with factor ${lengthFactor} → ${converted}mm exceeds sanity limit. Keeping raw value as mm.`);
  updates.total_length_mm = Math.round(Number(rawLength));
} else {
  updates.total_length_mm = converted;
}
```

Same guard for dimension columns.

## Files Changed
- `supabase/functions/extract-manifest/index.ts` — fix imperial detection patterns + set correct unit
- `supabase/functions/manage-extract/index.ts` — add sanity guard against double conversion

## Result
- Feet-only values like "5'" are correctly detected as imperial
- `parseDimension` output (inches) correctly paired with unit "in" → proper conversion: 60 × 25.4 = 1524mm
- Sanity guard prevents absurd values (464,515mm) from double conversion
- Display in "ft" mode: 1524/304.8 = 5.00 ✓

