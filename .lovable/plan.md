

## Fix: Stop Event Propagation on QueueCard Buttons

### Problem
Clicking "Edit" or delete icons on manifests in the Production Queue triggers the parent `CollapsibleTrigger` click handler (which toggles the folder open/closed), and the Edit button navigates to `/shopfloor/cutter` because that's the current `onEditPlan` behavior. The event bubbles up through the collapsible trigger.

### Changes

**File: `src/components/office/ProductionQueueView.tsx`**

1. **Line 558** — Add `e.stopPropagation()` to the Edit button:
   ```tsx
   onClick={(e) => { e.stopPropagation(); onEdit(); }}
   ```

2. **Line 570** — Add `e.stopPropagation()` to the Delete button:
   ```tsx
   onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
   ```

These two changes prevent clicks on the Edit and Delete buttons from bubbling up to the parent `CollapsibleTrigger`, which was collapsing/expanding the folder and interfering with the intended action.

| File | Change |
|---|---|
| `ProductionQueueView.tsx` | Add `e.stopPropagation()` to Edit and Delete buttons in `QueueCard` |

