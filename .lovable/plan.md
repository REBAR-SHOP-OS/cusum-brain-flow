

# Fix Home Button Visibility in Ad Director Result View

## Problem
The Home button (`fixed top-4 left-4`) is partially hidden behind other floating elements (avatar, camera icon, chat button) in the bottom-left area. From the screenshot, users cannot fully see or access it.

## Solution
Move the Home button from `top-4 left-4` to a position that doesn't conflict with other fixed UI elements. Since the TopBar is at the top and the floating dock elements are in the bottom-left, the best approach is to move it slightly right and down, or place it inside the content area instead of fixed positioning.

## Change

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` (line 463) | Change `fixed top-4 left-4` to `fixed top-16 left-4` to position it below the TopBar (46px height), ensuring full visibility without overlap with other elements |

This moves the button from behind the TopBar area to just below it, where it's fully visible and accessible.

