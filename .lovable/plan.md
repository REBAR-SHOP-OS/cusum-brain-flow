

# Fix: Exclude completed deliveries from Delivery Ops

## Problem
Line 92 in `src/pages/DeliveryOps.tsx` explicitly includes `"delivered"` in the status filter:
```typescript
.in("status", ["pending", "staged", "scheduled", "in-transit", "delivered"])
```

## Fix
Remove `"delivered"` from the `.in()` array. Also remove `"pending"` since staged is the entry point for this board (pending deliveries haven't been through the Loading Station yet). The corrected filter:

```typescript
.in("status", ["staged", "scheduled", "in-transit"])
```

This is a single-line change in `src/pages/DeliveryOps.tsx` at line 92. No other files need modification.

Also clean up the unused `STATUS_LABELS` and `STATUS_COLORS` entries for `pending` and `delivered` — or leave them as-is since they're harmless maps.

