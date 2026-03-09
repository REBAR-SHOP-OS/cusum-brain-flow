

# Plan: Show All Users in Floating Chat Panel

## Problem
The "Start a Chat" popup in the floating dock (DockChatBar) only shows 4 users. The filter `p.is_active === false` hides profiles that aren't currently active/online.

## Change

### `src/components/chat/DockChatBar.tsx` (line 82)
Remove the `is_active` filter so all team members appear in the chat list regardless of online status:

```typescript
// Before:
const visibleProfiles = profiles.filter((p) => {
  if (p.id === myProfile?.id) return false;
  if (p.is_active === false) return false;
  if (isInternal) return p.email?.endsWith("@rebar.shop");
  return true;
});

// After:
const visibleProfiles = profiles.filter((p) => {
  if (p.id === myProfile?.id) return false;
  if (isInternal) return p.email?.endsWith("@rebar.shop");
  return true;
});
```

One line removed, one file. All company users will appear in the floating chat panel.

