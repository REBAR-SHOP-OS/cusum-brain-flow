

## Fix: Delete Message Shows False Error

### Root Cause

In `MessageThread.tsx` line 145, the code checks:
```typescript
if (error || !data?.length) {
  toast.error("Failed to delete message");
}
```

The `.select()` after `.delete()` can return an empty array even when the delete succeeds (RLS interaction). The `!data?.length` check then falsely triggers the error toast.

### Fix

**File**: `src/components/teamhub/MessageThread.tsx` (lines 139-150)

Remove the `.select()` call and the `data?.length` check. Only check for `error`:

```typescript
const handleDeleteMessage = async (msgId: string) => {
  const { error } = await (supabase as any)
    .from("team_messages")
    .delete()
    .eq("id", msgId);
  if (error) {
    toast.error("Failed to delete message");
  } else {
    toast.success("Message deleted");
  }
};
```

The realtime subscription will automatically remove the message from the UI for all users.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Remove `.select()` and `data?.length` check from delete handler |

