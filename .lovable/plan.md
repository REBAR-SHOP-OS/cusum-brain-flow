

# Remove Square Background on Brain Image

## Problem
The brain hero PNG (`src/assets/brain-hero.png`) has a visible square/rectangular background artifact showing behind it on the landing page. Even though `mix-blend-mode: screen` is applied, the dark square border of the PNG is still visible against the page background.

## Solution
Two CSS changes to the brain `<img>` element in `src/components/brain/InteractiveBrainBg.tsx`:

1. **Increase opacity blend** -- Currently at `0.55`. Lowering it slightly or adjusting the blend can help, but the real fix is the filter.
2. **Add a CSS `brightness` + `contrast` filter tweak** -- Adding `brightness(1.2) contrast(1.1)` to the existing `filter` property will wash out the dark square edges while keeping the brain details visible through `mix-blend-mode: screen` (screen mode makes dark pixels transparent, so boosting brightness pushes the square's dark edges closer to black = invisible).
3. **Alternative/additional**: Clip the image with `border-radius: 50%` or use `mask-image: radial-gradient(...)` to softly fade the edges so any remaining square artifact is gone.

The recommended approach is a **radial gradient mask** -- this creates a smooth circular fade that completely eliminates the square edge:

```css
maskImage: "radial-gradient(circle, white 40%, transparent 70%)"
```

## File Change
- `src/components/brain/InteractiveBrainBg.tsx` -- Add `WebkitMaskImage` and `maskImage` radial gradient to the brain `<img>` style to feather the edges and eliminate the visible square boundary.

