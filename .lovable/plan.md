

# Improve Sidebar Icon/Text Visibility

## Problem
The sidebar icons and text (e.g., "Collapse" label) are too dim against the dark background, making them hard to see.

## Change

**File: `src/index.css`**, dark theme section (~line 117):

Change `--sidebar-foreground` from `215 20% 65%` to `215 20% 85%` — this increases lightness from 65% to 85%, making icons and text significantly more visible while keeping the same hue.

```css
/* Before */
--sidebar-foreground: 215 20% 65%;

/* After */
--sidebar-foreground: 215 20% 85%;
```

This single CSS variable controls all non-active sidebar icon and text colors (used via `text-sidebar-foreground` in `Sidebar.tsx`). Active items already use `text-sidebar-accent-foreground: 210 40% 96%` which is bright enough.

## Result
- All sidebar icons and labels become clearly visible against the dark background
- Active/hover states remain distinct (they use separate accent variables)
- No component code changes needed — purely a CSS variable update

