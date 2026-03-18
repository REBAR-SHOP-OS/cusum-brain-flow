

## Fix: RECENTS Not Showing Confirmed Dates

### Root Cause
Two issues prevent RECENTS from displaying:

1. **Missing Realtime Publication**: The `purchasing_confirmed_lists` table is NOT in the `supabase_realtime` publication. The hook subscribes to realtime changes, but the DB never emits them — so after confirming, the sidebar doesn't auto-refresh.

2. **Unnecessary `as any` cast**: The table IS in the Supabase types, but both the hook and `confirmList` use `as any` which suppresses proper type inference and can mask errors.

3. **No error logging**: If the fetch fails, the error is silently swallowed — no `console.error` for `confError`.

### Plan

**Database Migration:**
- Add `purchasing_confirmed_lists` to the `supabase_realtime` publication so realtime subscriptions work.

**File: `src/hooks/usePurchasingDates.ts`**
- Remove `as any` cast from the `from("purchasing_confirmed_lists")` call
- Add `console.error` when `confError` exists so failures are visible

**File: `src/hooks/usePurchasingList.ts`**
- Remove `as any` cast from the `from("purchasing_confirmed_lists")` call in `confirmList`
- After successful confirm, the realtime subscription in `usePurchasingDates` will now automatically trigger a refresh

These changes ensure: confirm icon → snapshot saved → realtime event fires → RECENTS sidebar auto-updates with the date.

