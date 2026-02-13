

# Audit and Optimize: Zebra Z411 on 4x6 Continuous Roll Tags

## Issues Found

### 1. Wrong Orientation
The card is **6in wide x 4in tall** (landscape). The Zebra Z411 with 4x6 continuous roll feeds labels **4in wide x 6in tall** (portrait). Every tag currently prints clipped or scaled incorrectly.

### 2. Conflicting Print CSS
Two separate `@media print` blocks in `index.css` (lines 202-241 and 244-259) fight each other. The second block sets `@page { size: A4; margin: 10mm }` which overrides the label-specific `@page { margin: 0 }`. Tags print with A4 margins on a 4-inch-wide roll.

### 3. Print CSS Destroys Tag Height
Line 216: `height: auto !important` removes the fixed tag height, so the tag collapses or overflows unpredictably instead of filling exactly one 4x6 label.

### 4. No Thermal Print Optimization
- Font sizes are too small for 203 DPI thermal heads (anything below 8pt may be illegible)
- The fake barcode (CSS divs) won't scan -- it's decorative
- `border-foreground/80` uses CSS variables that resolve to transparent in forced-color print contexts
- Shape images use `crossOrigin="anonymous"` which can fail on thermal printer RIP software

### 5. Layout Too Cramped for 4-inch Width
The main body grid (`grid-cols-[110px_1fr_1.2fr]`) was designed for 6 inches of horizontal space. At 4 inches wide, the center and right columns are squeezed, making dimensions and shape images unreadable.

### 6. Redundant Information
The tag repeats the same data in multiple places (Qty, Size, Mark, KG, Dwg appear twice each). On a smaller 4x6 portrait format, this wastes space.

---

## Plan

### 1. Flip Card to 4x6 Portrait (`RebarTagCard.tsx`)

Change the card dimensions from `6in x 4in` to `4in x 6in`. Restructure the internal layout to work vertically:

- **Top strip**: Timestamp + branding (keep as-is, it's compact)
- **Header row**: Mark, Size, Grade, Qty, Length -- change from 5-column grid to a 3+2 or stacked layout that fits 4 inches
- **Main body**: Switch from 3-column horizontal to a 2-row vertical layout:
  - Top half: Summary fields + dimensions (side by side, 2 columns)
  - Bottom half: Shape image (full width, more vertical space)
- **Footer**: Ref/Dwg/Job info + branding
- Remove duplicate fields (Qty, Size, KG, Dwg only appear once each)

### 2. Fix Print CSS (`index.css`)

- Merge the two conflicting `@media print` blocks into one
- Set `@page { size: 4in 6in; margin: 0; }` specifically for tag printing
- Set fixed `width: 4in !important; height: 6in !important` on `.rebar-tag`
- Use solid `border-color: #000` instead of CSS variable references
- Ensure `page-break-after: always` works for continuous roll (one tag per "page")

### 3. Thermal-Friendly Styling

- Minimum font size: 9px (anything smaller is illegible at 203 DPI)
- Replace all `border-foreground/80` with solid `border-black` in the tag
- Increase key data font sizes (Mark, Qty, Length) for glance-readability on the shop floor
- Remove the fake CSS barcode from footer (it doesn't scan and wastes space)
- Add `image-rendering: pixelated` for shape images to prevent thermal blurring

### 4. Optimize Cards View Container (`TagsExportView.tsx`)

- Change `max-w-[6.5in]` to `max-w-[4.5in]` in the cards grid container so the on-screen preview matches the actual print output

---

## Technical Details

### File: `src/components/office/RebarTagCard.tsx`

Complete restructure to 4x6 portrait layout:

```
+---------------------------+  4in
|  DATE/TIME    REBAR SHOP  |
+---------------------------+
| MARK  | SIZE  | GRADE     |
| (2xl) | (2xl) | (2xl)     |
+-------+-------+-----------+
| QTY   | LENGTH| WEIGHT    |
| (2xl) | (2xl) | (lg)      |
+-------+-------+-----------+
|  Shape   |  A: ___  G: ___|
|  Circle  |  B: ___  H: ___|
|  + Type  |  C: ___  J: ___|
|          |  D: ___  K: ___|
|          |  E: ___  O: ___|
|          |  F: ___  R: ___|
+----------+----------------+
|     SHAPE IMAGE            |
|     (full width)           |
+----------------------------+
| Ref:____  Dwg:____         |
| Item:___  Job:____         |
+----------------------------+
| R.S         REBAR.SHOP     |
+----------------------------+  6in
```

Key sizing:
- Mark/Size/Grade: `text-2xl font-black` (readable from arm's length)
- Qty/Length: `text-2xl font-black`
- Dimensions: `text-xs font-bold` (compact but legible at 203 DPI)
- All borders: solid `border-black` instead of CSS variables
- Shape image area: taller, full width for better visibility

### File: `src/index.css` (lines 198-259)

Merge both print blocks into one clean block:

```css
@media print {
  @page {
    size: 4in 6in;
    margin: 0;
  }

  body * { visibility: hidden !important; }

  .rebar-tag,
  .rebar-tag * {
    visibility: visible !important;
  }

  .rebar-tag {
    position: relative !important;
    width: 4in !important;
    height: 6in !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 1px solid #000 !important;
    border-radius: 0 !important;
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
    overflow: hidden !important;
    page-break-after: always;
    page-break-inside: avoid;
  }

  .rebar-tag * {
    color: #000 !important;
    border-color: #000 !important;
    background: transparent !important;
  }

  .rebar-tag .bg-black { background: #000 !important; }
  .rebar-tag .bg-white { background: #fff !important; }
  .rebar-tag img { image-rendering: pixelated; }
}
```

### File: `src/components/office/TagsExportView.tsx`

Line 281: Change container max-width:
```tsx
<div className="p-6 grid grid-cols-1 gap-6 max-w-[4.5in] mx-auto">
```

### Files Modified
- `src/components/office/RebarTagCard.tsx` -- portrait 4x6 layout, larger fonts, thermal-optimized
- `src/index.css` -- merged print blocks, correct page size, solid borders
- `src/components/office/TagsExportView.tsx` -- preview container width fix
