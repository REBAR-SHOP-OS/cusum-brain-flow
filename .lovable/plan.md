

## Fix: Refresh button not working in Stripe → QB Sync Panel

**Root Cause**: The Refresh button uses `isLoading` for the spinner, but `isLoading` is only `true` on the initial load (when there's no cached data). After the first load, `invalidateQueries` triggers a background refetch which sets `isFetching` to `true`, not `isLoading`. So the button appears to do nothing.

### Changes

**`src/components/integrations/StripeQBSyncPanel.tsx`**

1. Destructure `isFetching` instead of (or in addition to) `isLoading` from the sync records query
2. Use `isFetching` for the spinner animation on the Refresh icon
3. Switch from `invalidateQueries` to `refetchQueries` for more explicit behavior

Change the query destructuring (~line 53):
```typescript
const { data: syncRecords, isFetching } = useQuery({
```

Change the Refresh button (~line 155) to use `isFetching` for the spinner:
```typescript
<RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
```

