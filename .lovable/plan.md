

# Fix Ugly Outro Card — Better `drawCardToCanvas` Rendering

## Problem
The branded end card has the logo rendered dead-center overlapping the headline and subheadline text, making it unreadable (visible in screenshot: gold logo sitting on top of text lines).

The root cause is in `drawCardToCanvas()` — the "center" logo position places the logo at `H/2 - logoH/2 - 80` which lands right on top of the text at `H/2 - 60`. There's no layout awareness between logo and text elements.

## Fix

### 1. Rewrite `drawCardToCanvas` with proper layout engine
**File**: `src/components/ad-director/editor/IntroOutroEditor.tsx`

Replace the naive absolute-position rendering with a vertical stack layout that:
- Calculates total content height (logo + headline + sub + cta + website) first
- Centers the entire stack vertically
- Adds proper spacing between elements (30-40px gaps)
- Wraps long text lines using `measureText` + word-wrap logic
- Adds a subtle dark overlay/vignette behind text for better contrast against gradient
- Renders a rounded pill CTA button instead of plain text

### 2. Add new layout preset: "Split"
**File**: `src/types/adDirector.ts` + `IntroOutroEditor.tsx`

Add a `"split"` layout option — logo on left half, text stack on right half — which is a professional outro pattern that avoids overlap entirely.

### 3. Improve default card settings
**File**: `src/types/adDirector.ts`

- Default `logoPosition` to `"top"` with `layout: "logo-top"` (safest no-overlap default)
- Reduce default `headlineFontSize` from 64 to 52 for better fit
- Reduce default `logoScale` from 1 to 0.8

### Files
| File | Change |
|------|--------|
| `src/components/ad-director/editor/IntroOutroEditor.tsx` | Rewrite `drawCardToCanvas` with stack layout, text wrapping, CTA pill, vignette |
| `src/types/adDirector.ts` | Add `"split"` to layout union, update defaults |

