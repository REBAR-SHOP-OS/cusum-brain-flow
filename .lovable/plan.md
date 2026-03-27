

# Fix Print Layout: Standalone Page Per Tag

## Problem
Tags are still children of flex/scroll wrappers in print, causing layout distortion. Each `.rebar-tag` must render as a standalone page, independent of any parent layout.

## Changes — `src/index.css` (replace lines 241-293)

Three additions to the existing `@media print` block:

### 1. Document reset
```css
html, body, #root {
  width: 4in !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}
```

### 2. Kill all layout wrappers
```css
.flex, .grid, .overflow-auto, .overflow-hidden,
[data-radix-scroll-area-viewport],
[class*="ScrollArea"], [class*="scroll-area"] {
  display: block !important;
  overflow: visible !important;
  width: auto !important;
  height: auto !important;
}
```

### 3. Standalone tag (replaces current `.rebar-tag` block)
```css
.rebar-tag {
  position: static !important;
  float: none !important;
  display: block !important;
  width: 4in !important;
  height: 6in !important;
  margin: 0 auto !important;
  padding: 0 !important;
  border: 1px solid #000 !important;
  border-radius: 0 !important;
  background: #fff !important;
  color: #000 !important;
  box-shadow: none !important;
  overflow: hidden !important;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
}
```

Key differences from current:
- `display: block` instead of `flex` — tag becomes a standalone block, not a flex child
- `position: static` + `float: none` — removes any inherited positioning
- `height: 6in` fixed (not min/max) — exact label size
- `break-after: page` — modern page break alongside legacy `page-break-after`
- `margin: 0 auto` — centers on page

Everything else (hide chrome, visibility rules, driver-dropoff section) stays unchanged.

## Files Changed
- `src/index.css` — rewrite `@media print` rebar-tag rules + add document/wrapper resets

