

# Set RebarTagCard to Fixed 4in × 6in

## Problem
The card currently has `width: 4in` but `minHeight: auto`, so height varies by content. User wants exact 4in × 6in (standard thermal label size).

## Fix

### `src/components/office/RebarTagCard.tsx` — line 69

Change:
```tsx
style={{ width: "4in", minHeight: "auto", boxSizing: "border-box" }}
```
To:
```tsx
style={{ width: "4in", height: "6in", boxSizing: "border-box" }}
```

Also add `justify-between` to the outer flex container so content spreads evenly across the fixed height, preventing overflow or excess whitespace at the bottom.

## File Changed
- `src/components/office/RebarTagCard.tsx` — set fixed 4×6 inch dimensions + justify-between layout

