

## Add Profile Editor Dialog on Avatar Click in Team Hub Sidebar

### Problem
When a user clicks their avatar in the sidebar header, nothing happens. They should be able to upload a new profile picture and edit their name.

### Changes

**File**: `src/components/teamhub/ProfileEditDialog.tsx` (NEW)
- Create a dialog component with:
  - Avatar display with camera/upload overlay on hover
  - Hidden file input for avatar upload (uses `useAvatarUpload().uploadSingle`)
  - Input field for `full_name` with save button (uses `useProfiles().updateProfile`)
  - Cancel/Close button

**File**: `src/components/teamhub/ChannelSidebar.tsx`
- Make the avatar clickable (wrap in button or add `onClick`)
- Add state `profileEditOpen` to toggle the dialog
- Render `<ProfileEditDialog>` passing `myProfile`, open state, and close handler

### New Component: `ProfileEditDialog`

```
Props: { open, onClose, profile: Profile }

Layout:
┌─────────────────────────┐
│  [X]   Edit Profile     │
│                         │
│      (  Avatar  )       │
│    click to upload      │
│                         │
│  Full Name: [________]  │
│                         │
│  [Cancel]      [Save]   │
└─────────────────────────┘
```

- Uses existing `useAvatarUpload` hook for photo upload
- Uses existing `useProfiles().updateProfile` for name change
- After successful upload/update, queries are invalidated automatically (already in hooks)

| File | Change |
|---|---|
| `src/components/teamhub/ProfileEditDialog.tsx` | New dialog for avatar upload + name edit |
| `src/components/teamhub/ChannelSidebar.tsx` | Make avatar clickable, show ProfileEditDialog |

