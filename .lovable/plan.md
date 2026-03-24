

## Filter Team Members to @rebar.shop Only

### Problem
Line 57-59 currently includes `@gmail.com` users in the Team Members list. The user wants ONLY `@rebar.shop` domain users visible and able to use this feature.

### Fix

**File**: `src/components/teamhub/ChannelSidebar.tsx` (line 57-59)

```typescript
// BEFORE
const activeProfiles = profiles.filter((p) => 
  p.email?.endsWith("@rebar.shop") || p.email?.endsWith("@gmail.com")
);

// AFTER
const activeProfiles = profiles.filter((p) => 
  p.email?.endsWith("@rebar.shop")
);
```

Single line change — removes the `@gmail.com` condition so only `@rebar.shop` users appear in Team Members.

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Remove `@gmail.com` from profile filter |

