

## Click Own Name → Navigate to My Notes

### Problem
When a user clicks their own name in the Team Members list, it opens a DM with themselves instead of navigating to "My Notes" (the self-chat channel).

### Changes

**File**: `src/components/teamhub/ChannelSidebar.tsx`
- In `handleClickMember` (line 100), check if the clicked `profileId` matches `myProfile.id`
- If it matches, call `onSelect("__my_notes__")` instead of `onClickMember(profileId, name)` — this navigates to My Notes

```tsx
const handleClickMember = (profileId: string, name: string) => {
  if (myProfile && profileId === myProfile.id) {
    onSelect("__my_notes__");
  } else {
    onClickMember(profileId, name);
  }
  onClose?.();
};
```

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Redirect self-click to My Notes |

