

# Fix: Orphaned Deliveries Blocking New Creation

## Root Cause

The earlier bug ("Invalid packing_slip status: pending") caused a **partial write**: the delivery record was created successfully, but the packing slip insert failed. This happened 4 times for the same bundle, creating 4 orphaned deliveries with no packing slips.

Now, when the Loading Station checks for an existing delivery (`existingDelivery` query), it finds one of these orphans and shows "VIEW DELIVERY" instead of "CREATE DELIVERY". The Delivery Ops page shows them with "0 ITEMS" because there are no packing slips attached.

## Fix (3 changes)

### 1. Database cleanup — delete 4 orphaned deliveries
Migration to delete the orphaned delivery_stops and deliveries that have no packing slips:
```sql
DELETE FROM delivery_stops WHERE delivery_id IN (
  SELECT d.id FROM deliveries d
  WHERE NOT EXISTS (SELECT 1 FROM packing_slips ps WHERE ps.delivery_id = d.id)
  AND d.status = 'staged'
);
DELETE FROM deliveries WHERE id IN (
  SELECT d.id FROM deliveries d
  WHERE NOT EXISTS (SELECT 1 FROM packing_slips ps WHERE ps.delivery_id = d.id)
  AND d.status = 'staged'
);
```

### 2. `src/pages/LoadingStation.tsx` — make mutation atomic
If the packing slip insert fails, **delete the delivery** so we don't leave orphans. Wrap the cleanup in a `catch` block that deletes the created delivery before re-throwing.

### 3. `src/pages/LoadingStation.tsx` — harden existing-delivery check
Change the `existingDelivery` query to also join on `packing_slips` so orphaned deliveries without slips are ignored, allowing re-creation.

## Files Changed
- Database migration (cleanup orphans)
- `src/pages/LoadingStation.tsx` (atomic mutation + hardened existing check)

