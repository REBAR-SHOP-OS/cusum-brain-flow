

## Fix Forward-to-Member: Exclude Self from Team Members List

### Root Cause
The `ForwardMessageDialog` shows ALL `@rebar.shop` team members including the currently logged-in user. When the user clicks their own name, `openDMMutation` calls `create_dm_channel` RPC which correctly rejects self-DMs with "Cannot DM yourself".

### Fix

**File**: `src/components/teamhub/ForwardMessageDialog.tsx`

1. Accept a new prop `currentProfileId?: string` to identify the logged-in user
2. Filter out the current user from the `teamMembers` list:
```typescript
const teamMembers = profiles
  .filter((p) => p.email?.endsWith("@rebar.shop"))
  .filter((p) => p.id !== currentProfileId) // exclude self
  .filter((p) => p.full_name?.toLowerCase().includes(search.toLowerCase()));
```

**File**: `src/pages/TeamHub.tsx`

Pass `currentProfileId={myProfile?.id}` to `ForwardMessageDialog`.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ForwardMessageDialog.tsx` | Add `currentProfileId` prop, filter out self |
| `src/pages/TeamHub.tsx` | Pass `currentProfileId` to ForwardMessageDialog |

