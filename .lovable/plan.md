

# Fix: Deleted Emails Keep Reappearing

## Root Cause
When you delete an email, the code:
1. Removes it from the `communications` table in the database
2. Calls `sync()` to refresh data

The problem is that `sync()` calls the Gmail and RingCentral sync edge functions, which **re-import the deleted email from Gmail back into the database**. So the email is deleted then immediately re-created.

## Solution
Replace `sync()` with `refresh()` in all delete and archive handlers. The `refresh()` function only reloads data from the database without triggering external syncs.

## Technical Changes

### File: `src/components/inbox/InboxView.tsx`

In these 4 functions, replace `await sync()` with `await refresh()`:

1. **`handleDeleteEmail`** (~line 450): `await sync()` -> `await refresh()`
2. **`handleArchiveEmail`** (~line 464): `await sync()` -> `await refresh()`
3. **`handleBulkDelete`** (~line 481): `await sync()` -> `await refresh()`
4. **`handleBulkArchive`** (~line 499): `await sync()` -> `await refresh()`

Also update the `useCallback` dependency arrays to include `refresh` instead of `sync`.

This ensures deleted emails stay deleted, since we only reload what's in the database rather than re-importing from Gmail.

