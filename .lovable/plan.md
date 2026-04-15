

## Plan: Fix Content Area Clipping

### Problem
Line 1039 in `AIExtractView.tsx` sets `max-w-[100vw]` on the content wrapper. Since `100vw` is the full browser width (including the ~200px sidebar), the content area extends ~200px beyond its actual available space, cutting off the right edge of cards and table columns.

### Fix

**File: `src/components/office/AIExtractView.tsx`** — Line 1039

Replace:
```tsx
<div className="p-6 space-y-6 w-full max-w-[100vw] overflow-x-auto min-w-0">
```

With:
```tsx
<div className="p-6 space-y-6 w-full overflow-x-auto min-w-0">
```

Simply remove `max-w-[100vw]`. The parent flex layout already constrains the width correctly via `flex-1 min-w-0` on the `<main>` element. No `max-w` override is needed.

### Result
Summary cards and all content will fit within the visible area without being clipped on the right.

