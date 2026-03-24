

## Show Current User's Avatar in Sidebar Header

### Problem
The circled area in the sidebar header shows a generic `MessageSquare` icon. The user wants the logged-in user's profile avatar displayed there instead.

### Change

**File**: `src/components/teamhub/ChannelSidebar.tsx`

1. Accept a new prop `myProfile?: Profile` (the current user's profile)
2. Replace the `MessageSquare` icon block (lines 86-88) with an `Avatar` showing the user's photo or initials
3. Keep the same size (`w-8 h-8 md:w-9 md:h-9`) and rounded style

**File**: `src/pages/TeamHub.tsx`
- Pass `myProfile` to `ChannelSidebar`

### Result
The sidebar header shows the current logged-in user's avatar (photo or initials) instead of the generic chat icon.

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Replace MessageSquare icon with user Avatar |
| `src/pages/TeamHub.tsx` | Pass `myProfile` prop to ChannelSidebar |

