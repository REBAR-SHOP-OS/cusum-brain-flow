

# Add Customer Address in Ref Box — Truncated to Fit

## Current State
The Ref box (lines 161-168 in `RebarTagCard.tsx`) already shows `address` below the Ref line. However, long addresses can overflow the fixed-height card.

## Change — `src/components/office/RebarTagCard.tsx`

### Line 167: Restrict address text to prevent overflow
- Add `truncate` or `line-clamp-2` to the address div so it stays within the Ref box bounds
- Ensure the address text is capped at 2 lines max with ellipsis overflow

```tsx
// Before:
{address && <div className="text-[9px] leading-tight mt-0.5">{address}</div>}

// After:
{address && <div className="text-[9px] leading-tight mt-0.5 line-clamp-2">{address}</div>}
```

### Also ensure the Ref box has `overflow-hidden` to prevent any bleed:
- Add `overflow-hidden` to the parent div (line 162)

## Files Changed
- `src/components/office/RebarTagCard.tsx` — add text clamping on address, overflow-hidden on Ref box

## Result
Address always displays in the Ref box but is restricted to 2 lines with ellipsis, preventing layout overflow on thermal labels.

