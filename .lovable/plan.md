

# Fix: Pipeline Stage Order + Drag-and-Drop

## Problem 1: Stage Order Does Not Match Odoo

From the Odoo screenshot, the column order (left to right) is:

```text
Prospecting > New > Telephonic Enquiries > QC - Ben > Estimation-Ben > Estimation-Karthick > Hot Enquiries > Quotation Bids > Won > Shop Drawing > Shop Drawing Sent for Approval
```

The ERP currently has extra stages inserted that do not exist in Odoo: **Qualified**, **RFI**, **Proposal**, **Addendums**, and **Quotation Priority**. These need to be removed and the remaining stages reordered to match Odoo exactly.

### Fix

Update `PIPELINE_STAGES` in `src/pages/Pipeline.tsx` to match Odoo's exact order:

1. Prospecting
2. New
3. Telephonic Enquiries
4. QC - Ben
5. Estimation - Ben
6. Estimation - Karthick
7. Hot Enquiries
8. Quotation Bids
9. Won
10. Lost
11. Shop Drawing
12. Shop Drawing Sent for Approval

Remove: Qualified, RFI, Proposal, Addendums, Quotation Priority (these do not exist in Odoo).

**Data safety note**: Before removing stages, we will check if any existing leads use those stage IDs. If they do, they will need to be reassigned to prevent orphaned leads.

---

## Problem 2: Cannot Drag Cards to All Columns

The Radix UI `ScrollArea` component wraps the board with an internal viewport that uses `overflow: hidden`. This blocks native HTML5 drag-and-drop events from propagating to columns that are outside the initial visible area.

### Fix

Replace the Radix `ScrollArea` in `PipelineBoard.tsx` with a plain `div` using `overflow-x: auto`. This preserves horizontal scrolling while allowing native drag events to work across all columns.

---

## Technical Changes

| File | Change |
|------|--------|
| `src/pages/Pipeline.tsx` | Reorder `PIPELINE_STAGES` to match Odoo exactly, remove 5 non-Odoo stages |
| `src/components/pipeline/PipelineBoard.tsx` | Replace `ScrollArea` with native `overflow-x-auto` div to fix drag-and-drop |

No database changes needed. No edge function changes.

