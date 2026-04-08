

# Adjust Tag Card: Shape Up, Metadata Line Up

## Changes in `src/components/office/RebarTagCard.tsx`

**1. Shape section (#1) — align image to top instead of center (line 138-139)**
- Change `justify-center` to `justify-start` on the shape container
- Change `items-center` to `items-start` on the inner flex wrapper
- Reduce padding from `p-2` to `p-1 pt-0.5` so the image sits near the upper border

**2. Metadata section (#2) — move the border line up by reducing internal spacing (line 159)**
- The bottom border of the shape section (`border-b-2 border-black`) acts as the dividing line
- Reduce the shape section's bottom padding and the metadata section's top padding
- Change metadata `py-1` to `py-0.5` to pull content up closer to the line

Specifically:
- Line 138: `p-2` → `px-2 pt-0.5 pb-1`, `justify-center` → `justify-start`
- Line 139: `items-center justify-center` → `items-start justify-center`
- Line 159: `py-1` → `py-0.5`

