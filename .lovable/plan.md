

# Fix: Edit Rows Button Not Responding

## Analysis

After thorough code review, the `startEditing` function logic is correct — it builds an edit map from `activeRows` and sets `isEditing = true`. The button's `onClick={startEditing}` handler is properly wired.

The most likely cause is a **z-index / overflow clipping issue**. The Edit Rows button sits inside a flex toolbar at the top of the results Card, right next to the unit toggle buttons. On narrow viewports or when the toolbar content is wide, the button may be clipped by the Card's boundary or hidden behind an invisible scrollable layer.

Additionally, I noticed the toolbar (`div.flex.items-center.justify-between`) sits **outside** the scroll container (`div.h-[55vh].overflow-auto`), but the inner content has `min-w-[1400px]` — if the Card itself clips horizontally, the button at the far right could be visually present but not clickable.

## Fix

**File:** `src/components/office/AIExtractView.tsx`

### 1. Ensure toolbar has proper z-index and is not clipped
Add `relative z-20` to the toolbar div (line 2067) so it sits above the table's sticky headers (which have `z-10`).

### 2. Ensure the button area doesn't get swallowed by flex overflow
Add `flex-shrink-0` to the button container div (line 2071) to prevent it from being squeezed.

### 3. Add a console log to `startEditing` for debugging
Temporarily add `console.log("startEditing called", activeRows.length)` at the top of `startEditing` to confirm whether the click fires at all.

### Changes summary
```text
Line 2067: Add relative z-20 to toolbar div
Line 2071: Add flex-shrink-0 to button container
Line 788:  Add console.log for debugging
```

## Files Changed
- `src/components/office/AIExtractView.tsx` — fix toolbar z-index/overflow and add debug logging

