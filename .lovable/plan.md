

## Reorder Optimization Panel Below Data Table

### Problem
In the AI Extract workflow, the "Cut Optimization" panel (with Standard / Optimized FFD / Best Fit strategy cards) renders **above** the extracted data table. Users must select an optimization strategy before seeing the line items it will apply to. The natural flow should be: see your data first, then choose how to optimize it.

### Current Layout Order
1. Header / Pipeline steps
2. Action bar (Map, Validate, Optimize, Approve buttons)
3. **Optimization Panel** (strategy cards + config)
4. "Extracting" spinner (when applicable)
5. Approved/Rejected banners
6. Errors panel
7. Summary stats (Line Items, Total Pieces, Bar Sizes, Shape Types)
8. Data table (extracted rows)

### Proposed Layout Order
1. Header / Pipeline steps
2. Action bar
3. "Extracting" spinner
4. Approved/Rejected banners
5. Errors panel
6. Summary stats
7. Data table (extracted rows)
8. **Optimization Panel** (moved here -- below the table)

### Changes

**File: `src/components/office/AIExtractView.tsx`**

- Move the optimization panel JSX block (lines 1210-1317) to after the data table block (after line ~1570, the closing of the results table Card)
- Remove the comment on line 1365 (`{/* (Optimization panel moved above the table) */}`) since it's no longer relevant
- Keep the `optimizationPanelRef` and auto-scroll behavior intact so clicking "Optimize" still scrolls to the panel

This is a pure JSX reorder -- no logic, state, or handler changes needed.
