

# Fix: Work Orders Not Updating After Deletion

## Root Cause
The `StationDashboard` subscribes to realtime changes on `work_orders`, but the table was never added to the `supabase_realtime` publication. So delete/update events are silently ignored -- the cache shows stale data.

## Confirmed
- All 4 work orders (WO-MMDOOEBU, WO-MMJGCW9L, WO-MMF8QQ92, WO-MMDPX5T2) are **deleted from the database**
- The UI shows stale React Query cache

## Fix

### 1. Database Migration
Enable realtime for `work_orders`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
```

### 2. No Code Changes Needed
The realtime subscription in `StationDashboard.tsx` already correctly invalidates the `work-orders` query cache on any postgres change event. Once the table is published, deletes will trigger cache invalidation automatically.

## Immediate Workaround
Refreshing the page will clear the stale cache right now.

