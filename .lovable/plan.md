

# Make Tag Cards Horizontal and Fit to Page

## Problem
The Cards view in Tags & Export currently displays `RebarTagCard` components in a **single-column vertical stack** constrained to `max-w-[4.5in]`. The user wants them laid out **horizontally** (side by side), fitting the available page width.

## Root Cause
Line 429 in `TagsExportView.tsx`:
```
grid grid-cols-1 gap-6 max-w-[4.5in] mx-auto
```
This forces a single column with a narrow max-width.

## Fix

### File: `src/components/office/TagsExportView.tsx` (line 429)

Change the grid container from single-column to a responsive multi-column layout that fills the page:

```
// Before
<div className="p-6 grid grid-cols-1 gap-6 max-w-[4.5in] mx-auto">

// After
<div className="p-6 flex flex-wrap gap-6 justify-center">
```

### File: `src/components/office/RebarTagCard.tsx` (line 63)

Remove the fixed `height: "6in"` so the card sizes naturally to its content (prevents empty space on cards with no shape image), and use `min-height` instead for print:

```tsx
// Before
style={{ width: "4in", height: "6in", boxSizing: "border-box" }}

// After
style={{ width: "4in", minHeight: "auto", boxSizing: "border-box" }}
```

Keep the `print:break-after-page` class so printing still works at 4×6.

## Result
Cards flow horizontally across the page width, wrapping to the next row when space runs out. On a typical 1200px viewport, 2 cards fit side by side. The layout is responsive — narrower screens show 1 column, wider screens show 2-3.

## Files Changed
- `src/components/office/TagsExportView.tsx` — change grid to flex-wrap layout (line 429)
- `src/components/office/RebarTagCard.tsx` — remove fixed height (line 63)

