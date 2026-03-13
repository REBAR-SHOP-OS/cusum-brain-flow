

# Separate Style Icons from Product Icons with Visual Divider

## Problem
The image style icons and product icons in the Pixel agent toolbar are visually blending together, making it hard to distinguish which group is which.

## Changes

### `src/components/chat/ChatInput.tsx` (~lines 522-599)

1. **Add a label before each group** — small muted text "Style" before image styles, and "Products" before product icons
2. **Add a visible vertical divider** between the two groups (the current `border-l` is too subtle)
3. **Give each group a distinct background container** — a subtle rounded pill/container with different tint so they're clearly two separate sections

Specifically:
- Wrap the IMAGE_STYLES section in a container with a subtle background (`bg-muted/30 rounded-lg px-1.5 py-0.5`) and a small label
- Wrap the PRODUCT_ICONS section in a similar but visually distinct container (`bg-primary/5 rounded-lg px-1.5 py-0.5`) with its own label
- Add a thin vertical separator line (`w-px h-6 bg-border mx-1`) between them

### Files
- `src/components/chat/ChatInput.tsx`

