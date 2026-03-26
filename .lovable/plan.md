

# Auto-Add Commenter as Assignee + Support All File Types

## Problem
1. When a user comments or adds a note in the timeline, they are NOT automatically added to the assignee list (only @mentioned users are auto-added). Any @rebar.shop user who interacts should be auto-added.
2. The file attachment input only accepts `image/*,video/*` — users need to upload PDF, DWG, PNG, JPG, and any other file type.

## Changes

| File | Change |
|---|---|
| `src/components/sales/SalesLeadChatter.tsx` (line 457) | Change `accept="image/*,video/*"` to remove the accept filter entirely, allowing all file types |
| `src/components/sales/SalesLeadChatter.tsx` (line 468) | Update tooltip from "Attach photo or video" to "Attach file" |
| `src/components/sales/SalesLeadChatter.tsx` (line ~218, inside `onSuccess` of note submit) | After the existing @mention auto-add logic, add: auto-add the current user (commenter) as assignee if they have a @rebar.shop email and are not already in the assignee list. Use `allProfiles` to check the user's email domain. |

### Auto-add commenter logic (inserted after line ~250)
```typescript
// Auto-add the commenter themselves if @rebar.shop and not already assigned
if (onAddAssignee && currentUserId) {
  const assignedIds = new Set(assignees.map(a => a.profile_id));
  if (!assignedIds.has(currentUserId)) {
    const myProfile = allProfiles?.find(p => p.id === currentUserId);
    const myEmail = (myProfile as any)?.email as string | undefined;
    if (myEmail?.endsWith("@rebar.shop")) {
      onAddAssignee(currentUserId);
    }
  }
}
```

This ensures:
- Any @rebar.shop user who comments/logs a note is automatically added as assignee
- @mentioned @rebar.shop users continue to be auto-added (existing behavior)
- Users can upload any file type (PDF, DWG, PNG, JPG, etc.)

