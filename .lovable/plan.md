

# Fix: Invalidate Production Queue Data After Barlist Approval

## Problem
After approving an extract (which creates work orders, barlists, and cut plans), the Production Queue still shows "0 manifests" because the `handleApprove` success handler only calls `refreshSessions()` but never invalidates the `cutPlans`, `barlists`, or `projects` query caches.

## Fix

### File: `src/components/office/AIExtractView.tsx`
In the `handleApprove` function (around line 548), after `await refreshSessions()`, add invalidation calls for the related query keys:

```typescript
await refreshSessions();
queryClient.invalidateQueries({ queryKey: ["cutPlans"] });
queryClient.invalidateQueries({ queryKey: ["barlists"] });
queryClient.invalidateQueries({ queryKey: ["projects"] });
queryClient.invalidateQueries({ queryKey: ["production-queues"] });
```

`queryClient` is already available in the component (line 114). No other files need changes.

