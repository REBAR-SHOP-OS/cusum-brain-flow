
# Fix: Empty "Size" Field on Cutter Station Cards

## Investigation Summary

After extensive exploration, the "Size" field on the cutter station production cards corresponds to the `bar_code` property displayed in `ProductionCard.tsx` at line 149. Currently it renders as:

```tsx
<p className="text-sm font-bold text-foreground">{item.bar_code}</p>
```

This displays the bar code value (e.g., "10M", "15M") **without a label** and without any fallback for empty/null values. While the database currently has no null `bar_code` entries, the field lacks:
1. A descriptive "SIZE" label (like other fields such as "MARK / DWG" and "ORDER TARGET" have)
2. A fallback display when the value might be empty

## Scope

**Single file, single modification:**

| File | Change |
|------|--------|
| `src/components/shopfloor/ProductionCard.tsx` | Add "SIZE" label above `bar_code` value + add fallback for empty values |

No other files are touched. No styling changes to other fields. No database changes.

## The Fix

**File:** `src/components/shopfloor/ProductionCard.tsx`  
**Location:** Line 148-149

Currently:
```tsx
{/* Bar size */}
<p className="text-sm font-bold text-foreground">{item.bar_code}</p>
```

After fix:
```tsx
{/* Bar size */}
<div>
  <p className="text-[9px] text-muted-foreground font-medium tracking-[0.15em] uppercase">
    Size
  </p>
  <p className="text-sm font-bold text-foreground">{item.bar_code || "—"}</p>
</div>
```

This adds:
- A "SIZE" micro-label above the value (matching the visual pattern of "MARK / DWG" and "ORDER TARGET" labels already used on the card)
- A dash fallback ("—") if `bar_code` is ever null or empty, preventing a visually blank field

## What Is NOT Changed

- `CutterStationView.tsx` -- untouched
- `BenderStationView.tsx` -- untouched
- `BarSizeGroup.tsx` -- untouched
- `StationHeader.tsx` -- untouched
- All other card fields (MARK / DWG, badge, shape diagram, progress) -- untouched
- Database -- untouched
- Styling of existing elements -- untouched
