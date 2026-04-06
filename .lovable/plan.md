

# Make Avatar Bar Larger and More Readable

## Problem
The avatar bar is still too small despite the previous increase. The user wants it significantly bigger and more readable.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` (lines 483-520)

Scale up all avatar bar elements substantially:

1. **Container**: `px-5 py-3 gap-3` → `px-5 py-4 gap-4`
2. **"All" button**: `px-3.5 py-1.5 text-sm` → `px-5 py-2.5 text-base font-semibold`
3. **User buttons**: `px-3 py-1.5 text-sm gap-2` → `px-4 py-2.5 text-base gap-3`
4. **Avatar circles**: `w-7 h-7 text-xs` → `w-10 h-10 text-sm`
5. **Names**: `text-sm font-semibold` → `text-base font-bold`

Result: Avatar circles become 40px (nearly double), text becomes `text-base` (16px), and padding/spacing increases throughout for a bold, easy-to-read bar.

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — scale up avatar bar elements

