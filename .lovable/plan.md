

# Make Brain Visible on Landing Page Hero

## Problem
The landing page hero section (lines 53-57 in `Landing.tsx`) renders the brain as a static `<img>` at `opacity-[0.08]` (8%) with a heavy gradient overlay on top, making it nearly invisible. The dynamic `InteractiveBrainBg` component is only used on the `/brain` page.

## Solution
Replace the static brain image in the hero with the fully interactive `InteractiveBrainBg` component that was just rewritten with neuro-electric effects.

## Changes to `src/pages/Landing.tsx`

### 1. Import `InteractiveBrainBg`
Add import for the interactive component. Remove the unused `brainHero` import.

### 2. Replace Static Brain Background
Replace the current hero background (lines 54-57):
```tsx
// CURRENT -- static, 8% opacity, invisible
<img src={brainHero} alt="" className="w-full h-full object-cover opacity-[0.08]" />
<div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background" />
```

With the interactive component plus a lighter gradient so the brain shows through:
```tsx
<InteractiveBrainBg />
<div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80" />
```

The gradient is lighter at the top (`/40` instead of `/60`) and transparent in the middle so the brain, glows, particles, and neural pathways are clearly visible. The bottom stays dark (`/80`) to ensure text contrast for the stats row.

### 3. Ensure z-index stacking
Add `relative z-10` to the hero content `<div>` so text stays above the interactive background.

---

## Files Modified
- `src/pages/Landing.tsx` -- swap static brain for InteractiveBrainBg, lighten gradient overlay

## No Other Changes
- `InteractiveBrainBg.tsx` stays as-is (already rewritten with responsive neuro-electric effects)
- No new dependencies
- No schema changes
