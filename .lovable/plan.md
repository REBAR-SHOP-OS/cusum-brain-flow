
# Fix: Activity Bar Always Visible with Correct Colors

## Root Cause
The activity bar IS rendering, but nearly all leads have `expected_close_date = NULL`, so the entire bar is grey (`#d1d5db`) on a grey background (`#e5e7eb`) -- making it invisible. Only stages like "Quotation/Bids" and "Quotation Priority" have some overdue (red) leads.

## What Changes

### 1. Match Odoo's bar style exactly (`PipelineColumn.tsx`)
Looking at the Odoo screenshot reference, the bar in Odoo is:
- A solid dark blue/grey bar when there are no activities
- Shows green/orange/red segments only when activities exist
- The "no activity" color is a dark muted blue-grey, NOT light grey

Changes:
- Update "none" color from `#d1d5db` (light grey, invisible) to `#a0aec0` (slate/blue-grey, visible like Odoo)
- Increase bar height from `h-2` to match Odoo's more prominent 4px bar
- Always show the bar even when all leads are "none" status -- the bar container already does this but the segment needs to render for all leads

### 2. Ensure all segments render even for "none" status
The current code skips segments with `count === 0`. This is correct. But when ALL leads are "none", only one grey segment renders. The fix is simply making the grey color more visible (point 1 above).

### 3. Verify the bar container always renders
The bar already renders always (`total > 0` check exists). No change needed here.

## Technical Details

### Color update (`PipelineColumn.tsx`)
```typescript
const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  planned: "#21b632",   // green
  today: "#f0ad4e",     // orange  
  overdue: "#d9534f",   // red
  none: "#a0aec0",      // slate blue-grey (matching Odoo's dark "no activity" bar)
};
```

And update the bar container background to be slightly lighter so the "none" segment contrasts:
```tsx
<div className="mt-1.5 h-2 w-full rounded-full overflow-hidden flex" 
     style={{ backgroundColor: '#cbd5e1' }}>
```

This ensures:
- Columns with no activity dates show a visible slate-blue bar (like Odoo)
- Columns with mixed statuses show green/orange/red/grey segments clearly
- Clicking any segment still filters the leads in that column

## Files Modified

| File | Change |
|---|---|
| `src/components/pipeline/PipelineColumn.tsx` | Update "none" color to visible slate blue-grey; adjust bar background for contrast |
