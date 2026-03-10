

# Fix: Eliminate Page-Level Horizontal Scrollbar

## Problem
The page shows a horizontal scrollbar because two sections overflow their container:
1. **Mapping panel preview table** — DIMS column pushes past viewport
2. **Line items table** — has `min-w-[1400px]` forcing the page wider

## Changes

**File: `src/components/office/AIExtractView.tsx`**

1. **Main container**: Change line 810 from `overflow-x-hidden` to add explicit `max-w-[100vw]` to hard-cap width.
2. **Line items table wrapper** (line 1841-1842): The outer div already has `max-w-full`, but the inner div forces `min-w-[1400px]`. Wrap in `overflow-x-auto` and remove `max-w-full` from outer (it's already constrained). The `overflow-auto` on line 1841 should handle this, but the parent containers need `overflow-hidden` or `min-w-0` to prevent bleed-through.
3. **Add `min-w-0`** to parent flex/grid containers that wrap these sections to allow content to shrink below intrinsic width.

**File: `src/components/office/BarlistMappingPanel.tsx`**

4. **Preview table** (line 286): Already has `overflow-x-auto` — confirmed OK.
5. **Card root** (line 219): Already has `overflow-hidden` — confirmed OK. Add `max-w-full min-w-0` to ensure it respects parent constraints.

**Root cause**: The `min-w-[1400px]` on the line items inner div (line 1842) is correct for making the table scrollable internally, but the cascade of parent containers doesn't prevent this minimum width from propagating up. Adding `min-w-0` on key flex children and ensuring `overflow-hidden` on the right parent will contain it.

