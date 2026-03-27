

# Fix: Rebar Tag Print Preview Layout Issues

## Problem
The tag cards look correct on-screen but render incorrectly in the browser's print preview. The root cause is in the `@media print` CSS in `src/index.css`.

## Root Cause Analysis

Three CSS issues combine to break print layout:

1. **`body * { visibility: hidden !important; }`** (line 257) — hides ALL elements globally, then only `.rebar-tag` and its children are made visible. But the **parent containers** (ScrollArea, flex wrapper `div.flex.flex-wrap`) remain `visibility: hidden`. While `visibility: hidden` preserves layout space, the print renderer can still mishandle positioning when parent containers are invisible.

2. **Fixed `height: 6in !important`** (line 272) — forces every tag to exactly 6 inches tall regardless of content. The on-screen card uses `minHeight: auto` with flexbox, letting the shape image area (`flex-1`) fill naturally. In print, the fixed height can cause content clipping (`overflow: hidden`) or excessive whitespace.

3. **`position: relative !important`** (line 270) — combined with hidden parents, tags may not flow in the expected block layout for page breaks.

## Solution

Rewrite the `@media print` section for `.rebar-tag` to:

1. **Replace `body * { visibility: hidden }` approach** with a cleaner method: hide non-print elements by class (`.no-print-tag`) instead of blanket-hiding everything. Add `.no-print-tag` to sidebar, header, toolbar — and let `.rebar-tag` cards flow naturally.

2. **Remove `height: 6in !important`** — use `min-height: 6in` instead so content is never clipped but tags don't shrink below label size.

3. **Remove `position: relative !important`** — let normal flow handle placement.

4. **Ensure the flex-wrap container prints correctly** — add `display: block` to the tag wrapper in print so tags stack vertically with page breaks.

### Specific Changes

**`src/index.css`** — rewrite `@media print` block:
```css
@media print {
  @page {
    size: 4in 6in;
    margin: 0;
  }

  /* Hide everything except tags */
  body > *:not(#root) { display: none !important; }
  
  /* Hide app chrome: sidebar, header, toolbars */
  nav, header, aside,
  [data-sidebar], [role="navigation"],
  .no-print-tag,
  button, .scroll-area-scrollbar {
    display: none !important;
  }

  /* Tag container: stack vertically */
  .rebar-tag {
    display: flex !important;
    flex-direction: column !important;
    width: 4in !important;
    min-height: 6in !important;
    max-height: 6in !important;
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
    visibility: visible !important;
    color: #000 !important;
    border-color: #000 !important;
  }
}
```

**`src/components/office/TagsExportView.tsx`** — add `no-print-tag` class to toolbar/filter elements so they're hidden in print.

## Files Changed
- `src/index.css` — rewrite print styles
- `src/components/office/TagsExportView.tsx` — add no-print classes to toolbar

