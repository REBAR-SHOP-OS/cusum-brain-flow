

# Fix Card Selection & Enable Root Deletion

## Problem
1. **Selection doesn't work**: When clicking a card in selection mode, `toggleSelectPost` skips posts with `status === "scheduled"` or `status === "published"`. Since most posts are published/scheduled, clicking does nothing.
2. **No root deletion**: The delete only removes individual post rows. User wants permanent, unrestricted deletion.

## Root Cause
- `isProtectedPost` (line 100-103) blocks selection of scheduled/published posts
- `toggleSelectAll` (line 165) also filters these out
- `handleSelectDay` (line 173) filters via `isProtectedPost`
- This means the vast majority of posts can never be selected or deleted

## Plan

### File: `src/pages/SocialMediaManager.tsx`

1. **Remove protection guard from selection** — Allow ALL posts to be selected regardless of status:
   - `toggleSelectPost`: Remove the `isProtectedPost` check and toast — just toggle the id
   - `toggleSelectAll`: Remove the `.filter(p => p.status !== "scheduled" && p.status !== "published")` — select all filtered posts
   - `handleSelectDay`: Remove `isProtectedPost` filter — select all day posts
   - `handleBulkDelete`: Remove `isProtectedPost` filter — delete all selected posts

2. **Keep delete confirmation dialog** — Still require confirmation before bulk delete (safety measure)

3. **Ensure `deletePost` actually removes from DB** — Verify the mutation does a hard delete (not soft/status change)

### File: `src/components/social/SocialCalendar.tsx`

4. **Fix card click in selection mode** — Currently clicking a grouped card toggles ALL post IDs in that platform group. This is correct behavior but was blocked by the protection guard. With guard removed, it will work.

5. **Add individual checkbox click** — Make the checkbox in the card corner clickable separately (with `e.stopPropagation()`) so users can select without triggering group navigation.

## Result
- Clicking any card's checkbox selects/deselects all posts in that platform group
- Day-level checkbox selects all posts for that day
- Delete button permanently removes all selected posts from the database
- No status-based restrictions on selection

## Files Changed
- `src/pages/SocialMediaManager.tsx` — remove protection guards
- `src/components/social/SocialCalendar.tsx` — improve checkbox click handling

