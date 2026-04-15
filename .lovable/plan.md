

## Plan: Fix Horizontal Scroll Not Reaching End of Table

### Problem
The line items table in AIExtractView has a wrapper `div` with `min-w-[1400px]` that caps the scrollable width. The actual table content (8 fixed columns + 12 dimension columns) exceeds 1400px, so the scrollbar thinks the content ends at 1400px while the real table extends further — cutting off the rightmost columns.

### Fix

**File: `src/components/office/AIExtractView.tsx`** — Line 2250

Replace:
```tsx
<div className="min-w-[1400px]">
```

With:
```tsx
<div className="w-max min-w-full">
```

This lets the inner div grow to match the actual table width (`w-max`), while ensuring it's at least as wide as the container (`min-w-full`). The outer scrollable div already handles overflow correctly.

### Result
Scrolling all the way right will show all columns completely.

