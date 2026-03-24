

## Populate Profile Page from Database & Show Avatar Everywhere

### Problem
1. The Settings profile form fields (name, surname, job title) are empty — not loaded from the database profile
2. Changes to these fields are not saved back to the database
3. The `UserMenu` avatar shows only initials, never the profile photo

### Changes

| File | Change |
|---|---|
| `src/pages/Settings.tsx` | Load `formData` from `myProfile` on mount (full_name split into name/surname, title, preferred_language). Add a "Save" button that calls `updateProfile`. |
| `src/components/layout/UserMenu.tsx` | Import `useProfiles`, find `myProfile`, show `AvatarImage` with `avatar_url` in both the trigger button and the dropdown header |

### Detail

**Settings.tsx**:
- Add `useEffect` to populate `formData` from `myProfile` when it loads (split `full_name` by space into name + surname, map `title` → `jobTitle`)
- Add a `handleSave` function that calls `updateProfile.mutate({ id: myProfile.id, full_name, title })` 
- Add a "Save changes" button below the Personal Details section

**UserMenu.tsx**:
- Import `useProfiles` hook
- Find `myProfile` by matching `user_id === user.id`
- Add `<AvatarImage src={myProfile?.avatar_url} />` to both Avatar instances (trigger + dropdown)
- Show `myProfile?.full_name` instead of email prefix where available

