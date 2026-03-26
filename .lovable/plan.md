

# Move Home Button to Top & Make It Larger

## Problem
The Home button (circle with house icon) is at the bottom of the result page, small and subtle. User wants it moved to the top and made bigger/bolder.

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`

1. **Remove** the Home button block at the bottom (lines 582-591)
2. **Add** a prominent Home button at the **top** of the result section (inside the `z-10` content div, before the preview), styled as a larger, bolder button:
   - Size: `w-14 h-14` (from `w-12 h-12`)
   - Icon: `w-7 h-7` (from `w-5 h-5`)
   - Background: solid `bg-primary` with white icon (from `bg-primary/10` with teal icon)
   - Shadow and ring for visibility
   - Positioned at top-left or top-center of the result area

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Move Home button from bottom to top of result section, make it larger and bolder |

