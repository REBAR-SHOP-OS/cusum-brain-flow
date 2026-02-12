

# Remove Dark Square Background from Brain Image

## Problem
The `brain-hero.png` image has a dark rectangular background baked into the PNG file. This creates a visible dark square behind the brain on the landing page hero, which looks bad.

## Solution
Apply `mix-blend-mode: screen` to the brain `<img>` element. This CSS blend mode makes dark pixels transparent and keeps bright pixels visible -- effectively removing the dark square while preserving the glowing brain circuits.

## Changes to `src/components/brain/InteractiveBrainBg.tsx`

On the brain `<img>` element (line 98), add `mix-blend-mode: screen` to the inline style object. This single CSS property will:
- Make the dark background of the PNG invisible (black becomes transparent with screen blending)
- Keep the bright cyan/teal brain circuit lines fully visible
- Blend naturally with the glow effects behind it

No other changes needed -- just one CSS property addition.

## Files Modified
- `src/components/brain/InteractiveBrainBg.tsx` -- add `mixBlendMode: "screen"` to brain image style

