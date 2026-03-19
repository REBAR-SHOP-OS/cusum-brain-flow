

# Make Floating Vizzy Button Show Full Face, Larger

## Problem
The current floating button is 64px with heavy orbital rings and a zoomed/cropped avatar, making Vizzy's face small and obscured. The user wants the button to be primarily Vizzy's face, big and clear.

## Changes

### File: `src/components/vizzy/FloatingVizzyButton.tsx`

1. **Increase button size**: Change `BTN_SIZE` from `64` to `80` (bigger face)
2. **Remove orbital SVG rings**: Delete the outer spinning dashed circle and static circle SVG block — these clutter the button and shrink the visible face area
3. **Remove pulse ring**: Delete the ping animation span
4. **Simplify avatar container**: Keep the rounded avatar with a subtle border/glow but remove