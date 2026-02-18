

# Changes to Employee Tasks Kanban Board

## Scope
Only `src/pages/Tasks.tsx` -- no other files or database changes.

## Changes

### 1. Remove Ai and Kourosh columns
Filter out profiles with emails `ai@rebar.shop` and `kourosh@rebar.shop` from the employee list so their columns never render.

### 2. Show task creator on each card
Add a small line below the task title showing "by [Creator Name]" using the existing `created_by_profile` join data. This appears on both active and completed task items.

### 3. Current user's column appears first
On page load, get the current authenticated user's ID via `supabase.auth.getUser()`. When sorting columns, move the employee whose `user_id` matches the current user to position 0 (first column). All other columns remain alphabetically sorted.

### 4. Send notification on task creation
After a task is created successfully, insert a row into the existing `notifications` table:
- `user_id` = the `user_id` of the assigned employee (from profiles data)
- `type` = "notification"
- `title` = "New Task Assigned"
- `description` = task title (truncated)
- `status` = "unread"

This uses the existing notifications infrastructure (the `useNotifications` hook and inbox panel already handle display and sound).

## Technical Details

### Excluded emails (hardcoded constant)
```
EXCLUDED_EMAILS = ["ai@rebar.shop", "kourosh@rebar.shop"]
```

### Column ordering logic
```
1. Get current user ID from auth
2. Sort employees alphabetically (existing)
3. Filter out excluded emails
4. Move current user's profile to index 0
```

### Notification insert (in createTask function, after successful insert)
```
Insert into notifications table with the assigned employee's user_id
```

## Files Modified
1. `src/pages/Tasks.tsx` only
