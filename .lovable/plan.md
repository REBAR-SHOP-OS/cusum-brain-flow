

# Root Cause: Scheduled Posts Not Persisting to Database

## Investigation Results

After deep database inspection:

- **Zero posts** in the database have `status = 'scheduled'` -- ever
- **Zero posts** were updated today (March 10) despite the "Post scheduled ✅" toast
- **Zero posts** have `scheduled_date` in the current calendar week (Mar 9-15)
- The cron job runs correctly every minute but consistently finds 0 posts to publish

**The scheduling mutation is silently failing.** The toast fires but the database is never updated. This is likely because:

1. The Supabase `.update().eq().select().single()` chain may return `{ data: null, error: null }` on RLS-blocked updates in certain edge cases
2. The `onSuccess` callback fires because React Query considers a resolved promise (returning `null`) as success
3. Neither `SchedulePopover` nor `PostReviewPanel`'s DateSchedulePopover verify the DB state after mutation

## Plan

### 1. Fix `useSocialPosts.ts` — Guard against null data in updatePost

The `mutationFn` returns `data` which can be `null` if the update affected 0 rows. Add a null-data check so it throws instead of silently succeeding:

```typescript
if (!data) throw new Error("Update failed — post not found or permission denied");
```

### 2. Fix `SchedulePopover.tsx` — Add DB verification (same pattern as PostReviewPanel)

After `onSuccess`, query the DB to verify `status = 'scheduled'`. If verification fails, show error toast instead of success.

### 3. Fix `PostReviewPanel.tsx` — Same null-data guard

The "Approve and Schedule" button path already has verification, but the DateSchedulePopover path needs the same safety net from the `useSocialPosts` fix.

### 4. Add diagnostic logging to `useSocialPosts` updatePost

Log the full response (`data` and `error`) so that next time this happens, console logs reveal the exact failure.

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useSocialPosts.ts` | Add `if (!data) throw new Error(...)` in updatePost mutationFn |
| `src/components/social/SchedulePopover.tsx` | Add verification query in onSuccess, show error if status != scheduled |

These two changes will:
- **Prevent false success toasts** by catching null-data responses
- **Surface the real error** so the user knows scheduling failed
- **Enable the cron to work** because posts will only show as "scheduled" when truly persisted

