

## Add Delete Channel/Group for Admin Users

### Problem
There's no way to delete user-created channels or groups from the sidebar. Only radin, neel, and sattar `@rebar.shop` should have this ability.

### Changes

**File**: `src/components/teamhub/ChannelSidebar.tsx`

1. Add `useAuth` import and get current user email
2. Define admin emails constant: `["radin@rebar.shop", "neel@rebar.shop", "sattar@rebar.shop"]`
3. For each channel row (line 162-175) and group row (line 197-210): if user is admin AND the channel is NOT "Official Channel", "Official Group", or "My Notes", show a `Trash2` icon button on hover (using the existing `group` class on the row)
4. Add `onDeleteChannel` prop to the interface
5. Clicking the trash icon opens an `AlertDialog` confirmation before deleting
6. Add state for `channelToDelete` to track which channel is pending deletion

**File**: `src/pages/TeamHub.tsx`
- Import and use `useDeleteChannel` hook (already exists in `useChannelManagement.ts`)
- Pass `onDeleteChannel` handler to `ChannelSidebar`
- If deleted channel was the active one, reset selection

### Protected channels (cannot be deleted)
- Official Channel
- Official Group  
- My Notes

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Add trash icon for admins, confirmation dialog |
| `src/pages/TeamHub.tsx` | Wire up `useDeleteChannel`, pass handler to sidebar |

