

# Add Delete Profile Photo Button to Settings Page

## Problem
There is no way to remove/delete a profile photo on the Settings page. Users can only upload a new one via the camera icon but cannot revert to the default avatar.

## Solution
Add a small "delete" (trash/X) icon button next to the camera icon on the avatar. When clicked, it clears the `avatar_url` on the profile and removes the file from storage.

## Changes

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add a delete avatar button (Trash2 icon) that appears only when a photo exists. On click: update profile `avatar_url` to `null`, remove file from storage, show toast. Position it opposite the camera button (bottom-left of avatar). |

### Implementation Detail

- Import `Trash2` from lucide-react
- Add a `handleAvatarDelete` function:
  - Call `supabase.from("profiles").update({ avatar_url: null }).eq("id", myProfile.id)`
  - Attempt `supabase.storage.from("avatars").remove([profileId + ".*"])` (best-effort cleanup)
  - Invalidate profiles query
  - Show success toast
- Render the delete button at `absolute bottom-0 left-0` (mirroring the camera button on the right), only when `myProfile?.avatar_url` exists
- Style: same size/shape as camera button but with `hover:bg-destructive/10` and red icon color

