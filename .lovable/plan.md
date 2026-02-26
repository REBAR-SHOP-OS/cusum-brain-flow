

## Fix Brain Square — More Aggressive Mask Fade

The mask gradient (`white 30%, transparent 70%`) isn't fading enough of the dark rectangular edges. The brain PNG has a large solid dark background that extends to its corners, so the mask needs to start fading earlier and finish sooner.

### Change in `src/components/office/AIExtractView.tsx`

**Line 525-526** — Change the radial gradient mask to fade more aggressively:

```
Before: radial-gradient(circle, white 30%, transparent 70%)
After:  radial-gradient(circle, white 15%, transparent 55%)
```

This makes the visible (white) center smaller and the fade-to-transparent happen much earlier, ensuring the dark rectangular corners of the PNG are fully invisible. The brain circuit lines in the center remain fully visible.

Single edit, two lines changed.

