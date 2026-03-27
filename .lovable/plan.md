

# Fix: Tags Clipped in Print Preview

## Problem
The print preview screenshot shows the URL `https://erp.rebar.shop/office` — the user is printing directly from the office page (Ctrl+P), not using the dedicated `/print-tags` route. The office page's sidebar, ScrollArea, and flex wrappers are constraining the tags, causing right-side clipping.

## Root Cause
The `@media print` rules in `src/index.css` hide the sidebar but don't neutralize the layout wrappers (flex containers, scroll areas, overflow-hidden) that constrain the `.rebar-tag` cards in the office view.

## Two Options

### Option A: Force users through `/print-tags` (recommended)
The dedicated print route already works correctly with full isolation. Instead of allowing Ctrl+P from the office page, auto-redirect print to the clean route:

**File: `src/components/office/TagsExportView.tsx`**
- Add a `beforeprint` event listener that cancels native print and opens `/print-tags` instead
- This ensures print always goes through the clean isolated route

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault();
    handlePrint(); // opens /print-tags in new window
  };
  window.addEventListener("beforeprint", handler);
  return () => window.removeEventListener("beforeprint", handler);
}, [handlePrint]);
```

### Option B: Fix the global print CSS to also handle office page
**File: `src/index.css`** — add wrapper-killing rules back to `@media print`:

```css
@media print {
  /* Kill layout wrappers for rebar tags */
  .flex, .grid, .overflow-auto, .overflow-hidden,
  [data-radix-scroll-area-viewport],
  [class*="ScrollArea"] {
    display: block !important;
    overflow: visible !important;
    width: auto !important;
    height: auto !important;
  }

  html, body, #root {
    width: 4in !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .rebar-tag {
    display: block !important;
    width: 4in !important;
    height: 6in !important;
    page-break-after: always;
    break-after: page;
  }
}
```

**Problem with Option B**: These broad rules break printing for other pages (driver dropoff, documents, etc.).

## Recommendation: Option A
Intercept Ctrl+P on the office/tags page and redirect to `/print-tags`. This keeps print isolation clean without polluting global CSS.

## Files Changed
- `src/components/office/TagsExportView.tsx` — add `beforeprint` event listener

