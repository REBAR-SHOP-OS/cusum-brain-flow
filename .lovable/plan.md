

# Fix: LINE ITEMS Unit Toggle Overwrites Confirmed Source Unit

## Problem

There are **two separate unit toggles** that both write to `confirmedUnitRef.current`:

1. **Mapping Panel** (SOURCE DATA UNITS) — correctly sets the source unit for conversion (e.g. "Inches" means raw values × 25.4 → mm)
2. **LINE ITEMS** toggle (mm / in / ft / ft-in) — should be **display-only** but incorrectly also sets `confirmedUnitRef.current`

When a user:
1. Selects "Inches" in the mapping panel → `confirmedUnitRef = "in"` ✓
2. Confirms + applies mapping → values correctly converted (54 in → 1372 mm) ✓
3. Clicks "mm" in the LINE ITEMS display toggle → **`confirmedUnitRef = "mm"`** ✗ — source unit corrupted
4. If they re-apply or the system references confirmedUnitRef, it now thinks source was "mm"

This also causes confusion because the LINE ITEMS toggle changes the header label (LENGTH (mm) vs LENGTH (in)) but the stored values are always mm internally after mapping.

## Fix

### `src/components/office/AIExtractView.tsx` — line 2079-2082

**Remove** `confirmedUnitRef.current = u` from the LINE ITEMS unit toggle. Keep only the display state change:

```tsx
// Before (buggy):
onClick={() => {
  userSetUnitRef.current = true;
  confirmedUnitRef.current = u;      // ← REMOVE THIS LINE
  setSelectedUnitSystem(u);
}}

// After (fixed):
onClick={() => {
  userSetUnitRef.current = true;
  setSelectedUnitSystem(u);
}}
```

This ensures:
- The mapping panel's SOURCE DATA UNITS is the **only** place that sets the confirmed source unit for conversion
- The LINE ITEMS toggle is purely a **display format** selector (mm ↔ in ↔ ft ↔ ft-in) applied via `formatLengthByMode`
- Re-applying mapping won't use a corrupted unit

## File Changed
- `src/components/office/AIExtractView.tsx` — remove `confirmedUnitRef.current = u` from LINE ITEMS toggle (1 line)

