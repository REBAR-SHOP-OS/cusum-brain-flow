

# Fix Print Layout: Kill All Layout Wrappers in Print Context

## Problem
The `.rebar-tag` cards are trapped inside ScrollArea, flex wrappers, and overflow-hidden containers that clip and distort the tags during print. The current print CSS only hides chrome elements but doesn't neutralize the layout wrappers surrounding the tags.

## Solution
Add rules to `src/index.css` `@media print` block that:

1. **Reset `html`, `body`, `#root`** to `width: 4in`, `height: auto`, no margin/padding, `overflow: visible`
2. **Neutralize all layout wrappers** (`.flex`, `.grid`, `.overflow-auto`, `.overflow-hidden`, scroll-area elements) by forcing `display: block`, `overflow: visible`, `width: auto`, `height: auto`

### Changes to `src/index.css` (inside existing `@media print` block, after line 258)

```css
/* Reset document for label printing */
html, body, #root {
  width: 4in !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}

/* Kill ALL layout wrappers */
.flex, .grid, .overflow-auto, .overflow-hidden,
[data-radix-scroll-area-viewport],
[class*="ScrollArea"], [class*="scroll-area"] {
  display: block !important;
  overflow: visible !important;
  width: auto !important;
  height: auto !important;
}
```

This is inserted right after the "hide app chrome" rules and before the `.rebar-tag` rules.

## Files Changed
- `src/index.css` — add wrapper-killing rules to `@media print` block

