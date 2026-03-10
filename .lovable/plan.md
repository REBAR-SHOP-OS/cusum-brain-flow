

# Fix: Extract Rows Require Retry — Missing Realtime Publication

## Root Cause

The `extract_rows` and `extract_sessions` tables are **not added to the `supabase_realtime` publication**. The hooks subscribe to realtime channels, but those channels never fire because the tables aren't publishing changes. This means:

1. When extraction completes and the edge function inserts rows, the UI never gets notified
2. The initial fetch races against the session status update, often returning 0 rows
3. Only the manual "Retry" button (after 10s timeout) triggers a re-fetch that works

## Fix

### Database Migration

Add both tables to the realtime publication so the existing subscriptions actually work:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.extract_rows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.extract_sessions;
```

### No Frontend Changes

The hooks already have correct realtime subscriptions — they just need the publication to be enabled.

### Expected Result

- When extraction completes, the UI auto-refreshes immediately (no retry needed)
- Session status changes propagate in real time
- The 10s retry button remains as a fallback but should rarely be needed

