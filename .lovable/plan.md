

# Fix Task Creator to Show Actual User

## Overview
Currently, all tasks are hardcoded to be created by Neel (`NEEL_PROFILE_ID`), and the board only shows Neel's tasks. This change makes the system use the actual logged-in user as the task creator, and shows all tasks across all creators.

## Scope
Only `src/pages/Tasks.tsx` -- no other files change.

## Changes

### 1. Use current user's profile ID when creating tasks
Instead of hardcoding `created_by_profile_id: NEEL_PROFILE_ID`, fetch the current user's profile ID and use that. The current user's auth ID is already available (`currentUserId`), so we need to also store their profile ID.

### 2. Remove the Neel-only filter on task loading
Currently tasks are filtered with `.eq("created_by_profile_id", NEEL_PROFILE_ID)`. This filter will be removed so tasks from all creators are visible in the board.

### 3. Creator name already displayed
The "by [Name]" label on each task card already works correctly using `task.created_by_profile?.full_name` -- no change needed there. Once tasks are created with the real user's profile ID, the correct name will appear automatically.

## Technical Details

### New state
- Add `currentProfileId` state (string | null) alongside existing `currentUserId`
- In the `useEffect` that fetches the current user, also query `profiles` table to get the profile ID matching that `user_id`

### Task creation change (line 285)
```
created_by_profile_id: currentProfileId   // was NEEL_PROFILE_ID
```

### Task fetching change (line 174)
Remove the `.eq("created_by_profile_id", NEEL_PROFILE_ID)` filter so all tasks assigned to @rebar.shop employees are shown regardless of creator.

### Subtitle change
The "X tasks by Neel" subtitle will change to just "X tasks" since tasks are no longer filtered to one creator.

## Files Modified
1. `src/pages/Tasks.tsx` only
