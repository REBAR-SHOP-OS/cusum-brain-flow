

## Problem

When the user clicks "Optimize", the status updates to "optimizing" and the optimization panel with mode cards renders — but it renders **below the table** (which is `h-[55vh]`), out of the visible viewport. The user doesn't see it and thinks nothing happened. Additionally, the Optimize button disappears (replaced by "Approve & Create WO") giving the impression the page is stuck.

## Fix

### `src/components/office/AIExtractView.tsx`

1. **Move the Optimization Panel above the table**: Reorder the JSX so the optimization panel (mode cards + config) renders **between** the action bar and the line items table, not after it. This ensures it's immediately visible when the user clicks Optimize.

2. **Auto-scroll to optimization panel**: After `handleStartOptimize` completes, scroll the optimization panel into view using a `ref` and `scrollIntoView()`.

3. **Keep the step context clear**: When in "optimizing" status, show a small info banner above the Approve button explaining "Select a cutting plan below, then click Approve."

