

# Improve User Avatar Bar in Vizzy Brain Panel

## Problem
The user avatar bar (horizontal profile selector) is too small and cramped. It needs to be displayed more prominently — larger avatars, bigger text, better spacing.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` (lines 483-520)

Increase the size and prominence of the avatar bar:

1. **Container**: Increase padding from `px-5 py-2` → `px-5 py-3`, add `gap-3` instead of `gap-2`
2. **"All" button**: Increase from `px-2.5 py-1 text-xs` → `px-3.5 py-1.5 text-sm`
3. **User buttons**: Increase from `px-2 py-1 text-xs` → `px-3 py-1.5 text-sm`, add `gap-2` between avatar and name
4. **Avatar circles**: Increase from `w-5 h-5 text-[10px]` → `w-7 h-7 text-xs`
5. **Names**: Add `text-sm font-semibold` for better readability

Result: Larger, clearer, more touchable avatar buttons that are easy to read and interact with.

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — resize avatar bar elements

