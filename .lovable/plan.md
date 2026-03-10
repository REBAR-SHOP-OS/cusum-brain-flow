

# Fix: Bar List Column Mapping — Fit to Page

## Problem
The mapping panel and preview table overflow horizontally, causing content to extend beyond the viewport (visible in the screenshot with the red circle highlighting the overflow).

## Changes

**File: `src/components/office/BarlistMappingPanel.tsx`**

1. **Wrap the entire card** in `overflow-hidden` so nothing bleeds out.
2. **Mapping grid items**: Reduce `min-w-[90px]` on labels to `min-w-[70px]` and add `truncate` so long labels don't force width.
3. **Preview table**: Wrap in a horizontal `ScrollArea` or `overflow-x-auto` div so the table scrolls internally instead of pushing the page.
4. **DIMS column**: Add `max-w-[150px] truncate` to prevent long dimension strings from blowing out the table width.
5. **Select triggers**: Add `min-w-0` to allow them to shrink within flex containers.

All changes are CSS/layout only — no logic changes.

