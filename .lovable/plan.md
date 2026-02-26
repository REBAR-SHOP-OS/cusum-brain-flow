

## Fix Brain Overlay — Remove Black Square, Add Smooth Fade

The brain processing overlay currently shows a harsh dark rectangle because the PNG image has a solid black/dark background baked in. The fix involves making the overlay blend seamlessly with the page.

### Changes to `src/components/office/AIExtractView.tsx`

**1. Remove the harsh black square from the brain image** (lines 516-524):
- Add `mix-blend-mode: screen` to the brain image — this makes the black background transparent, leaving only the glowing cyan brain visible
- Increase opacity so the brain itself is more visible
- Add a smooth CSS fade-in animation when the overlay appears

**2. Improve the backdrop** (line 504):
- Keep the backdrop blur but make it subtler so content behind peeks through nicely

**3. Add fade-in animation to the entire overlay** (line 502):
- Wrap in `animate-fade-in` class for a smooth entrance

### Specific edits:

- **Line 502**: Add `animate-fade-in` to the overlay container
- **Lines 516-524**: Add `style={{ mixBlendMode: "screen" }}` and bump opacity from `opacity-30` to `opacity-70` so the brain glows through without the black box
- **Lines 544-547**: Adjust the float animation to use higher opacity range since blend mode handles transparency

### Technical detail
`mix-blend-mode: screen` mathematically removes black pixels (they become transparent) while preserving bright/light pixels (the cyan brain circuit lines). This is the standard technique for removing dark backgrounds from glowing images without needing alpha transparency.

