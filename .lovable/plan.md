

# Sync PrintTag (Print Route) with RebarTagCard (Office View)

## Problem
The `PrintTag` component in `src/pages/PrintTags.tsx` (lines 46-153) was never updated to match the recent layout changes made to `RebarTagCard.tsx`. The print version still shows:
- Shape code circle + "Shape" label instead of **brand logo**
- Ref/Dwg/Item in a **2-column grid** instead of Dwg/Item in shape area + full-width Ref

## Solution
Update the `PrintTag` component in `PrintTags.tsx` to mirror the current `RebarTagCard` layout, using inline styles (since print route avoids Tailwind).

### Changes in `src/pages/PrintTags.tsx` (lines 94-145)

**1. Replace shape circle with brand logo (lines 94-101):**
- Remove the circle div with shape code text
- Add `<img>` with `logo-coin.png` (import at top of file)
- Style: `width: 64px, height: 64px, objectFit: contain`

**2. Dims grid — ensure parallel A-F / G-R columns (lines 102-115):**
- Already correct layout, no change needed

**3. Shape image area — add Dwg/Item caption (lines 118-130):**
- Add Dwg and Item as a compact row below the shape image, inside the same flex container
- Style: `fontSize: 12, fontWeight: 900, display: flex, gap: 16`

**4. Ref section — make full width (lines 132-145):**
- Remove `gridTemplateColumns: "1fr 1fr"` grid
- Remove the Dwg/Item column
- Make Ref + address span full width with more vertical space (`minHeight: 56px`)

## File Changed
- `src/pages/PrintTags.tsx` — sync PrintTag layout with RebarTagCard (logo, Dwg/Item in shape area, full-width Ref)

