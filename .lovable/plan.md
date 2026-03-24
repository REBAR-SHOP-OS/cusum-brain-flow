

## Add Create Channel & Create Group Buttons to Sidebar

### Problem
The sidebar currently only shows hardcoded "Official Channel" and "Official Group". The `CreateChannelDialog` component and `useCreateChannel` hook already exist, but users have no visible button to create new channels or groups. User-created channels are also filtered out in the sidebar.

### Changes

**File**: `src/components/teamhub/ChannelSidebar.tsx`

1. **Show all group channels** — Change the `groupChannels` filter (line 61) from only showing `"Official Channel"` to showing all channels of type `"group"` that are NOT "Official Group":
   ```
   const groupChannels = channels.filter((c) => c.channel_type === "group" && c.name !== "Official Group");
   ```

2. **Show all group-type entries under Groups** — Change the `officialGroup` filter (line 62) to include "Official Group" plus any user-created groups (or keep as-is if groups use a different `channel_type`).

3. **Add "+" button next to CHANNELS header** (line 146-150) — A small `Plus` icon button that calls `onCreateChannel()` to open the existing `CreateChannelDialog`.

4. **Add "+" button next to GROUPS header** (line 170-177) — Same pattern, triggers a new callback `onCreateGroup()` to create a group.

**File**: `src/components/teamhub/ChannelSidebar.tsx` (props)
- Add `onCreateGroup?: () => void` prop

**File**: `src/pages/TeamHub.tsx`
- Add state + handler for creating groups (reuse `CreateChannelDialog` with a "group" flag, or add a second dialog)
- Pass `onCreateGroup` to `ChannelSidebar`

**File**: `src/components/teamhub/CreateChannelDialog.tsx`
- Add optional `mode: "channel" | "group"` prop to change dialog title and icon
- When mode is `"group"`, title says "Create Group" and uses `Users` icon

### Result
- "+" button appears next to both CHANNELS and GROUPS headers
- Clicking opens the existing create dialog (with appropriate title)
- New channels/groups appear in sidebar immediately after creation

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Show all channels/groups, add "+" buttons |
| `src/components/teamhub/CreateChannelDialog.tsx` | Add `mode` prop for channel vs group |
| `src/pages/TeamHub.tsx` | Wire up create group handler, pass to sidebar |

