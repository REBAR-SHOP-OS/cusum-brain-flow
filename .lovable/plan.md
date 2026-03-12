

# Make CC (Closed Captions) Look Filthy

## Current State
The `drawSubtitle()` function in `src/lib/videoStitch.ts` renders plain white bold text on a flat black semi-transparent bar — generic and boring.

## What We'll Build
A premium, cinematic subtitle renderer with:
- Rounded pill-shaped background with blur/glassmorphism effect (simulated via gradient)
- Text shadow and glow for depth
- Word-by-word highlight animation (karaoke-style active word glow)
- Subtle gradient on the background pill (dark → darker)
- Clean typography with letter spacing

## File to Modify

### `src/lib/videoStitch.ts` — rewrite `drawSubtitle()`

Replace the basic black bar + white text with:

1. **Rounded pill background** — `roundRect` with 16px radius, narrower width (fitted to text + padding), centered at bottom
2. **Gradient fill** — dark translucent gradient (rgba(0,0,0,0.75) → rgba(10,10,10,0.85)) instead of flat black
3. **Text glow** — white `shadowBlur: 8` on the text for a cinematic glow effect
4. **Bold modern font** — `'Inter', 'SF Pro Display', sans-serif` with slight letter-spacing via `letterSpacing`
5. **Subtle border** — 1px stroke with `rgba(255,255,255,0.15)` on the pill for glass edge
6. **Bottom positioning** — floating pill ~40px from bottom with padding, not a full-width bar

The function signature stays the same so no other code changes are needed.

