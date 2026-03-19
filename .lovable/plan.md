

# Fix: FloatingVizzyButton Layout and Avatar

## Problems (from screenshot)
1. Action buttons (mic, chat) overlap and look messy when expanded — positioned with absolute + translate causing visual collision
2. Avatar image is too small/zoomed out — agent's face should fill the circle prominently

## Changes

### File: `src/components/vizzy/FloatingVizzyButton.tsx`

**1. Fix action button positioning** — Fan them out cleanly in an arc above the main button:
- Voice (mic) button: position top-right (`x: -50, y: -50`) 
- Chat button: position directly above (`x: 0, y: -70`)
- Remove `left-1/2 -translate-x-1/2` which causes overlap; use `top-0 left-0` as base with motion x/y for precise placement

**2. Zoom avatar image** — Add `scale(1.5)` transform and `objectPosition: "center 30%"` to crop and center the agent's face within the circle, making it prominent and recognizable.

### Summary of visual changes:
- Mic button fans out to upper-left of avatar
- Chat button fans out directly above avatar  
- Agent face fills the circular button prominently
- Clean spacing, no overlapping icons

