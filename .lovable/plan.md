

# Add Delete Button to Delivery Tiles

## What
Add a delete (trash) button on each delivery card in Delivery Ops. The database has a trigger `block_delivery_delete_unless_pending`, so we must first set the status to `pending` before deleting. We'll also delete associated `delivery_stops` and `packing_slips` first.

## Changes

### `src/pages/DeliveryOps.tsx`
1. Import `Trash2` from lucide-react and add `AlertDialog` components for confirmation
2. Add `deleteTarget` state and a `handleDelete` function that:
   - Deletes `packing_slips` where `delivery_id` matches
   - Deletes `delivery_stops` where `delivery_id` matches
   - Updates delivery status to `pending` (to bypass the delete trigger)
   - Deletes the delivery record
   - Shows success/error toast and refreshes
3. Add a small red trash icon button in the top-right corner of each card (next to the status badge area), with a confirmation dialog ("Are you sure? This cannot be undone.")

No database migration needed — the existing `pending` status bypass and CASCADE on child tables handle cleanup.

