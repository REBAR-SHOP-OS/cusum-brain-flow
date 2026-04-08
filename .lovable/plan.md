

# Move "Item" from Shape Section to Ref/Customer Section

## Problem
The "Item: X" label is currently inside the shape image area (position #1 in the screenshot). The user wants it moved down to the Ref/Customer/Remark section (position #2).

## Changes

### 1. `src/components/office/RebarTagCard.tsx`
- **Remove** the `Item` display from the shape section (lines 156-158 — the `div` with `flex gap-4`)
- **Add** an "Item" row inside the Ref/Customer/Remark block (line 162 area), as a new line like: `Item: {item}` — same style as Ref/Customer/Remark lines

### 2. `src/utils/generateZpl.ts`
- **Remove** `ITEM: ${item}` from line 119 (currently combined with DWG)
- **Add** a new `ITEM:` line in the Ref section (after REMARK), repositioning Y coordinates to fit 4 lines instead of 3

| File | Change |
|------|--------|
| `RebarTagCard.tsx` | Move Item from shape section to ref/customer block |
| `generateZpl.ts` | Move ITEM from DWG line to its own line in ref section |

