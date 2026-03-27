

# Fix Print Layout: Complete Wrapper Neutralization

## Problem
Tags are still clipped/distorted because ScrollArea, flex containers, and overflow-hidden wrappers constrain them in print context.

## Changes — `src/index.css` `@media print` block

Replace lines 241-293 with the complete print reset:

### 1. Document reset (NEW)
```css
html, body, #root {
  width: 4in !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}
```

### 2. Kill all layout wrappers (NEW)
```css
.flex, .grid, .overflow-auto, .overflow-hidden,
[data-radix-scroll-area-viewport],
[class*="ScrollArea"], [class*="scroll-area"] {
  display: block !important;
  overflow: visible !important;
  width: auto !important;
  height: auto !important;
}

* {
  overflow: visible !important;
}

::-webkit-scrollbar {
  display: none !important;
}
```

### 3. Standalone tag per page (REPLACES current `.rebar-tag` block)
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

Key changes from current:
- `display: block` (not flex) — standalone block element
- `position: static` + `float: none` — no inherited positioning
- `height: 6in` fixed (not min/max) — exact label size
- `break-after: page` — modern page break
- `margin: 0 auto` — centered
- Global `* { overflow: visible }` kills all scroll traps
- `::-webkit-scrollbar { display: none }` removes scrollbar space

### 4. Keep existing rules
- `.rebar-tag *` visibility/color rules stay
- `.bg-black`/`.bg-white`/`img` overrides stay
- Driver dropoff print section untouched
- `@page` definitions unchanged

## Files Changed
- `src/index.css` — rewrite `@media print` rebar-tag + add document/wrapper resets

