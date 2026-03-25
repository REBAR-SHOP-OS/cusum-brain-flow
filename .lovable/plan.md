

## Add Delete Confirmation Dialog to Inbox Bulk Delete

### Problem
The bulk delete button in the Inbox fires immediately without a confirmation dialog. When clicked, there is no warning showing how many emails will be deleted.

### Solution
Add a confirmation `AlertDialog` before executing `handleBulkDelete` (and `handleBulkArchive`), displaying the correct count from `selectedIds.size`.

### Changes

**File: `src/components/inbox/InboxView.tsx`**

1. Add state for delete confirmation: `const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);`
2. Change the Delete button's `onClick` from `handleBulkDelete` to `() => setShowDeleteConfirm(true)`
3. Add an `AlertDialog` that:
   - Shows: `"Delete ${selectedIds.size} email(s)?"`
   - Description: `"This action cannot be undone. The selected emails will be permanently deleted."`
   - On confirm: calls `handleBulkDelete()` then `setShowDeleteConfirm(false)`
   - On cancel: closes the dialog
4. Import `AlertDialog` components from `@/components/ui/alert-dialog`

| File | Change |
|---|---|
| `src/components/inbox/InboxView.tsx` | Add confirmation dialog before bulk delete using `selectedIds.size` for count |

