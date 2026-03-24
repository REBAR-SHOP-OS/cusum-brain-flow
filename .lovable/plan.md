

## Fix Forward Dialog: Long Text + Add Team Members Section

### Problems
1. Long message text overflows/breaks layout in the preview area
2. Only channels/groups are shown — need a "Team Members" section listing rebar.shop users so messages can be forwarded to individual team members via DM

### Changes

**File**: `src/components/teamhub/ForwardMessageDialog.tsx`

1. **Fix long text preview**: Change the preview text from `truncate` (single line) to `line-clamp-2` so long messages wrap to 2 lines max instead of breaking layout

2. **Add Team Members section**: 
   - Accept new props: `profiles` (Profile[]) and `onForwardToMember` (profileId, msg) callback
   - Filter profiles to only `@rebar.shop` emails
   - Apply search filter to both channels and members
   - Render a "Team Members" section below channels with avatar + name for each member
   - Clicking a member calls `onForwardToMember(profileId, msg)` and closes dialog

**File**: `src/pages/TeamHub.tsx`

1. Pass `profiles` to `ForwardMessageDialog`
2. Add `onForwardToMember` handler that:
   - Opens/creates a DM with the target profile (using `openDMMutation`)
   - Then forwards the message to that DM channel using `sendMutation`

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ForwardMessageDialog.tsx` | Fix text overflow, add Team Members list with avatars |
| `src/pages/TeamHub.tsx` | Pass profiles + onForwardToMember handler |

