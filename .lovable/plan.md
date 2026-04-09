

# Fix: Make Report Dialog Content Scrollable

## Problem
The detailed report dialog has `ScrollArea` but it doesn't scroll properly because the `ScrollArea` has no bounded height — `flex-1` alone may not constrain it when content overflows.

## Fix

### File: `src/components/vizzy/SectionDetailReport.tsx` (line 854)

Change the `ScrollArea` wrapper to have an explicit constrained height so it activates scrolling:

```tsx
// Line 854: Change from
<ScrollArea className="flex-1 pr-3 -mr-3">

// To
<ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
```

The key fix is adding `min-h-0` — in a flex column container, flex children default to `min-height: auto` which prevents them from shrinking below their content size. Adding `min-h-0` allows the `ScrollArea` to shrink and activate its internal scrollbar when content exceeds the dialog's `max-h-[90vh]`.

### Single line change
One CSS class addition in `SectionDetailReport.tsx`, line 854.

