

## Plan: Store Values in Source Units (No mm Conversion)

### Current State
The previous fix converts all values to mm before storing in `total_length_mm` and `dim_*` columns. The user wants the opposite: **store raw source-unit values as-is**. If the source is inches, store inches. If feet, store feet.

### Architecture Change

```text
BEFORE (current):                    AFTER (requested):
─────────────────                    ──────────────────
44.5" → store 1130mm                 44.5" → store 44.5 (inches)
100mm → store 100mm                  100mm → store 100 (mm)
6'    → store 1829mm                 6'    → store 6 (feet)
```

The column `total_length_mm` becomes a **source-unit value** — its name is misleading but renaming columns is destructive. The `unit_system` on the session tells consumers what unit the value is in.

### Changes Required

**1. Edge Function: `supabase/functions/manage-extract/index.ts`** (lines 344-358)

Revert the conversion block — store raw values directly:

```typescript
// NO conversion — store in source unit as-is
if (rawLength != null) {
  updates.total_length_mm = rawLength;  // raw source-unit value
}
for (const col of DIM_COLUMNS) {
  const rawVal = rawDims[col] ?? row[col];
  if (rawVal != null) {
    updates[col] = rawVal;  // no rounding, no conversion
  }
}
```

Response: `length_factor: 1` (no conversion applied).

**2. Optimization: `src/components/office/AIExtractView.tsx`** (lines 735-738, 773-776)

When feeding `total_length_mm` into the optimizer, convert to mm on-the-fly based on session unit:

```typescript
// Convert to mm for optimizer only
const toMm = (val: number) => {
  const u = activeSession?.unit_system;
  if (u === "in" || u === "imperial") return Math.round(val * 25.4);
  if (u === "ft") return Math.round(val * 304.8);
  return val; // mm
};

lengthMm: toMm(r.total_length_mm || 0),
```

Apply same fix at both optimization call sites (~line 737 and ~line 775).

**3. Weight Calculation: `src/components/office/RebarTagCard.tsx`** (line 11-16)

Update `getWeight` to accept a unit parameter and convert internally:

```typescript
export function getWeight(
  size: string | null, 
  lengthVal: number | null, 
  qty: number | null, 
  unit?: string
): string {
  if (!size || !lengthVal) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  // Convert to mm first
  let mm = lengthVal;
  if (unit === "in" || unit === "imperial") mm = lengthVal * 25.4;
  else if (unit === "ft") mm = lengthVal * 304.8;
  return ((mm / 1000) * mass * (qty || 1)).toFixed(2);
}
```

**4. Tags Export: `src/components/office/TagsExportView.tsx`** (line 58-63)

Same fix — its local `getWeight` also divides by 1000 assuming mm. Update to accept unit and convert.

**5. Print Tags: `src/pages/PrintTags.tsx`** (line 111)

Pass unit to `getWeight` calls.

**6. Edit Save: `src/components/office/AIExtractView.tsx`** (lines 951-960)

Currently converts edited values from display unit to mm via `displayModeToMm`. Since we're now storing in source unit, the edit input should store as-is (source unit), not convert to mm:

```typescript
// Store in source unit — no conversion
updateData.total_length_mm = raw;
```

**7. Display: `src/components/office/AIExtractView.tsx`** (lines 270-285)

The display function already handles raw values correctly — `raw_total_length_mm` stores the original. After this change, `total_length_mm` equals `raw_total_length_mm`, so display logic simplifies: just show `total_length_mm` with the session's unit symbol.

**8. Mapping Preview: `src/components/office/BarlistMappingPanel.tsx`** (line 28)

Change label from `"Cut Length (mm)"` to `"Cut Length"` — unit depends on session.

**9. Deploy** the `manage-extract` edge function.

### What stays the same
- `raw_total_length_mm`, `raw_dims_json` — still stored for backward compat
- `source_total_length_text`, `source_dims_json` — untouched
- Cut optimizer internal logic — unchanged (it already works in mm internally)
- Database schema — no column renames
- All format/display utilities — unchanged

### Risk Assessment
- **Shop floor / production**: Uses `cut_length_mm` from `cut_plan_items` (copied during approval). Need to verify this path also preserves source units or converts at copy time. Will check during implementation.
- **Existing data**: Previously stored values may be in mm (from the recent fix). Re-applying mapping will correct them.

