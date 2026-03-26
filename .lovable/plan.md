

# Make CameraLoader More Vibrant & Prominent

## Problem
The loading indicator (spinning icon, rings, progress bar, text) is too faint against the background video. User wants bolder colors and more visual prominence.

## Changes

### `src/components/ad-director/CameraLoader.tsx`

1. **Outer ring**: `border-primary/30` → `border-primary/60`, border width `border` → `border-2`
2. **Inner ring**: `border-primary/50` → `border-primary/80`, border width `border-2` → `border-[3px]`
3. **Glow backdrop**: opacity `0.2` → `0.5`, spread wider (`w-24 h-24`), add stronger box-shadow
4. **Camera icon**: `w-16 h-16` stays, add `filter: drop-shadow(0 0 12px hsl(var(--primary)))` for glow effect, `strokeWidth={1.5}` → `strokeWidth={2}`
5. **Status text**: `text-white/60` → `text-white/90 font-semibold text-base`
6. **Progress bar**: height `h-1` → `h-2`, track `bg-white/10` → `bg-white/20`, bar shadow stronger
7. **Percentage text**: `text-white/40` → `text-white/70 font-semibold`
8. **Cancel button**: `text-white/30` → `text-white/50`
9. **Animation keyframes**: increase opacity ranges (outer pulse `0.3→0.5` to `0.6→1.0`, inner `0.5→0.8` to `0.7→1.0`, glow `0.4→0.8` to `0.6→1.0`)

| File | Change |
|---|---|
| `CameraLoader.tsx` | Increase opacity, border width, glow intensity, text weight/size for all loader elements |

