

## Make Delete Button Visible and Add Confirmation Dialog

### Problem
The delete button already exists in code but has two issues:
1. It's nearly invisible -- uses `ghost` variant with tiny 3px icons on a dark card, making it unnoticeable
2. No confirmation dialog -- deletion happens immediately on click, which is risky for a destructive action

### Changes (1 file: `src/pages/Deliveries.tsx`)

#### 1. Make the trash button more visible
- Increase button size from `h-6 w-6` to `h-7 w-7`
- Increase icon size from `w-3 h-3` to `w-4 h-4`
- Change variant to `outline` with destructive styling so it stands out on the dark card background

#### 2. Add confirmation dialog before deletion
- Add `pendingDeleteId` state to track which delivery the user wants to delete (separate from `deletingDeliveryId` which tracks the async operation)
- When trash button is clicked, set `pendingDeleteId` instead of immediately deleting
- Show `ConfirmActionDialog` (already exists in the project at `src/components/accounting/ConfirmActionDialog.tsx`) with destructive variant
- On confirm, execute the existing `deleteDelivery` logic
- On cancel, clear `pendingDeleteId`

#### Visual Result
```text
+---------------------------------------------------+
| CHIMNEY FOUNDATION...  [pending] [trash-button]    |
| Feb 23, 2026                                       |
+---------------------------------------------------+
```

The trash button will be clearly visible with an outline/destructive style, and clicking it opens a confirmation dialog before proceeding with deletion.

### Technical Details

- Reuse the existing `ConfirmActionDialog` component (destructive variant with "Delete Delivery" confirm label)
- The `deleteDelivery` function signature changes slightly: instead of receiving `React.MouseEvent`, it just takes `deliveryId` string since it's now called from the dialog confirm handler
- The click handler on the trash button calls `e.stopPropagation()` and sets `pendingDeleteId`
- Dialog text: "Are you sure you want to delete this delivery? This will also remove all associated packing slips and delivery stops."

