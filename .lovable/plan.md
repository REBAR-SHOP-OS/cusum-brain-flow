

# Move Home Button to Top-Left Corner & Make It Purple

## Problem
The Home button is currently centered at the top of the result section. User wants it pinned to the top-left corner and colored purple.

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`

1. **Position**: Change the Home button container from inside the content flow to `fixed top-4 left-4` so it sits in the absolute top-left corner of the screen
2. **Color**: Change `bg-primary` to `bg-purple-600 hover:bg-purple-700` and ring to `ring-purple-400/30`
3. **Icon color**: Keep `text-white` for contrast on purple background

| Line | Change |
|---|---|
| 467-474 | Replace flex container with fixed-position button, purple styling |

