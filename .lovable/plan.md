

## Fix Hardcoded "MM" Unit Labels in Dimension Displays

### Problem
In `DetailedListView.tsx`, the dimension column subscript is hardcoded as `"MM"` regardless of the company's unit system setting. When the company uses imperial units, dimensions should not show "MM".

### Changes

**File: `src/components/office/DetailedListView.tsx`** (line 201)

Replace the hardcoded `MM` subscript with a dynamic label based on the unit system:

```tsx
// BEFORE (line 201)
{dims[c] ? <span className="text-foreground">{dims[c]}<sub className="text-[8px] text-muted-foreground ml-0.5">MM</sub></span> : ""}

// AFTER
{dims[c] ? <span className="text-foreground">{dims[c]}<sub className="text-[8px] text-muted-foreground ml-0.5">{unitSystem === "imperial" ? "IN" : "MM"}</sub></span> : ""}
```

The `unitSystem` variable is already available in this component (line 21: `const unitSystem = useUnitSystem()`), so no additional imports are needed.

| File | Change |
|---|---|
| `DetailedListView.tsx` line 201 | Replace hardcoded `"MM"` with dynamic unit label based on `unitSystem` |

