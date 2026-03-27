

# Replace "Dwg" with "Weight" in Shape Caption

## Change

In `src/components/office/RebarTagCard.tsx`, line 157: replace the "Dwg" label/value with "Weight" label/value.

**Before:**
```
Dwg: —    Item: 1
```

**After:**
```
Weight: 70.65    Item: 1
```

## Technical detail

- Line 157: Change `Dwg:` → `Weight:`, change `{dwg || "—"}` → `{weight || "—"}`
- The `weight` prop is already passed to the component and available.

## File Changed
- `src/components/office/RebarTagCard.tsx` — line 157 only

