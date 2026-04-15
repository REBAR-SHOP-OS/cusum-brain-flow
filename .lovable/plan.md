

## Plan: Add Visible Horizontal Scrollbar to Line Items Table

### Problem
The line items table has horizontal overflow content but the scrollbar is not visible/prominent enough to discover.

### Change

**File: `src/components/office/AIExtractView.tsx`**

On line 2249, the table wrapper `div` has `overflow-auto` but uses a tall container that may hide the scrollbar. Add a custom CSS class or inline style to make the horizontal scrollbar always visible using `overflow-x: scroll` and a webkit scrollbar styling.

Specifically:
- Change `overflow-auto` to `overflow-x-scroll overflow-y-auto` on the table container (line 2249)
- Add a custom scrollbar style to make it visually prominent (thicker, colored track/thumb) so the user can clearly see and use horizontal scrolling
- Add the custom scrollbar CSS to `src/index.css` targeting this specific container

### Result
A clearly visible horizontal scrollbar appears at the bottom of the line items table, allowing easy left-right navigation across all dimension columns.

