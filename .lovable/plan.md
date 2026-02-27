

## Fix: Show All Deliveries Including "Delivered"

The delivery in the database has status `"delivered"`, but the Delivery Ops page filters it out — it only queries for `pending`, `scheduled`, `staged`, and `in-transit`.

### Change to `src/pages/DeliveryOps.tsx`

Add `"delivered"` to the status filter on line 50 so all deliveries appear, or remove the `.in("status", ...)` filter entirely to show all deliveries regardless of status.

I recommend keeping the filter but adding `"delivered"` to it, so completed deliveries are also visible on the ops board.

