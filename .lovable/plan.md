

## Add Delete Channel/Group for Admin Users

### Problem
No way to delete user-created channels or groups from the sidebar. Only `radin@rebar.shop`, `neel@rebar.shop`, and `sattar@rebar.shop` should have this ability.

### Changes

**File**: `src/components/teamhub/ChannelSidebar.tsx`
1. Import `Trash2` icon and `AlertDialog` components, plus `useAuth` from `@/lib/auth`
2. Add admin email check: `const { user } = useAuth(); const isAdmin = ["radin@rebar.shop", "neel@rebar.shop", "sattar@rebar.shop"].includes(user?.email ?? "")`
3. Add state: `channelToDelete: TeamChannel | null`
4. Add `onDeleteChannel` prop to interface
5. On each channel row (lines 162-174) and group row (lines 197-209): if `isAdmin` and channel name is NOT in `["Official Channel", "Official Group", "My Notes"]`, show a `Trash2` button (visible on hover via `group-hover`)
6. Add an `AlertDialog` at the bottom that confirms deletion, calling `onDeleteChannel(channelToDelete.id)` on confirm

**File**: `src/pages/TeamHub.tsx`
1. Import `useDeleteChannel` from `@/hooks/useChannelManagement`
2. Create handler that calls `deleteChannel.mutateAsync(id)` and resets `selectedChannelId` if it was the deleted one
3. Pass `onDeleteChannel` to `ChannelSidebar`

### Protected channels (cannot be deleted)
- Official Channel
- Official Group
- My Notes

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Add trash icon for admins with confirmation dialog |
| `src/pages/TeamHub.tsx` | Wire up `useDeleteChannel`, pass handler to sidebar |

