

## Add Two-Way Delete Button for Authorized Users in Team Hub

### What
Add a delete icon (Trash2) on message hover that deletes the message from the database (for everyone) — only visible to the three authorized users: `radin@rebar.shop`, `sattar@rebar.shop`, `neel@rebar.shop`.

### Changes

#### `src/components/teamhub/MessageThread.tsx`

1. Add a `handleDeleteMessage` function that deletes from `team_messages` table by message ID:
   ```typescript
   const DELETE_ADMINS = ["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"];
   const canDelete = DELETE_ADMINS.includes(myProfile?.email ?? "");
   
   const handleDeleteMessage = async (msgId: string) => {
     const { error } = await supabase.from("team_messages").delete().eq("id", msgId);
     if (error) toast.error("Failed to delete");
     else toast.success("Message deleted");
   };
   ```

2. In the message actions hover section (line ~586-600), add a Trash2 button **conditionally** when `canDelete` is true:
   ```tsx
   {canDelete && (
     <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete for everyone">
       <Trash2 className="w-3.5 h-3.5" />
     </button>
   )}
   ```

The realtime subscription already listens for changes on `team_messages`, so the message will disappear for all users automatically after deletion.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Add delete handler + conditional Trash2 button for 3 admin emails |

