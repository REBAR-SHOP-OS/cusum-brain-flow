

## Hide Direct Messages Section from Team Hub Sidebar

The user wants to completely hide the "Direct Messages" section (header + all DM channels listed under it) from the `ChannelSidebar`.

### Change

**File**: `src/components/teamhub/ChannelSidebar.tsx`

Remove (or wrap in `{false && ...}`) the entire DMs section block (lines 162-190) which includes:
- The "Direct Messages" collapsible header button
- The DM channel list

Also remove the unused `dmsOpen` state variable and `dmChannels` filter since they'll no longer be needed.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Remove the entire DMs section (header + list), remove `dmsOpen` state and `dmChannels` filter |

