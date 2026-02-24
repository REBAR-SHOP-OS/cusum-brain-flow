
## Add Delete Button to Delivery Cards

### Current State
- Each delivery is shown as a `DeliveryCard` in the list, but there is no way to delete a delivery
- Packing slips already have a delete button (only for "draft" status), but deliveries themselves do not
- The `Trash2` icon is already imported

### Changes (1 file: `src/pages/Deliveries.tsx`)

#### 1. Add delete delivery state and function
- Add `deletingDeliveryId` state (similar to existing `deletingSlipId`)
- Create `deleteDelivery` function that:
  - Deletes related `packing_slips` for the delivery
  - Deletes related `delivery_stops` for the delivery
  - Deletes the `delivery` itself
  - Clears `selectedDelivery` if the deleted one was selected
  - Invalidates queries
  - Only allows deletion of "pending" deliveries (safety guard)

#### 2. Update `DeliveryList` and `DeliveryCard` components
- Pass `onDelete` callback and `deletingId` through `DeliveryList` to `DeliveryCard`
- Add a `Trash2` icon button to each `DeliveryCard` (only visible for "pending" status deliveries)
- Button calls `onDelete` with `e.stopPropagation()` to prevent card selection

#### Visual Result
```text
+------------------------------------------+
| CHIMNEY FOUNDATION...  [pending] [trash]  |
| Feb 23, 2026                              |
+------------------------------------------+
```

The delete button appears only on pending deliveries, matching the existing pattern used for packing slip deletion.
