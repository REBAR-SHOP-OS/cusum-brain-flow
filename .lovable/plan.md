

## Plan: Protect Scheduled & Published Posts from Deletion

### Problem
The bulk delete function allows deleting **any** selected post, including scheduled and published ones. The user wants these posts to be fully protected — never deletable.

### Changes

**File: `src/pages/SocialMediaManager.tsx`**

1. **Guard bulk delete** (line ~168): Before deleting, filter out any posts with `status === "scheduled"` or `status === "published"`. Only delete the remaining (drafts, declined, pending_approval).

2. **Prevent selection of scheduled/published posts in selection mode**: In `toggleSelectPost`, check the post status and skip selection if it's scheduled or published. This gives immediate visual feedback that these posts can't be selected for deletion.

3. **Hide day-select checkbox logic**: The `onSelectDay` handler should also skip scheduled/published post IDs.

4. **Show toast warning** if user tries to select a protected post, e.g. "Scheduled and published posts cannot be deleted."

### Summary
- 1 file modified: `src/pages/SocialMediaManager.tsx`
- Scheduled/published posts become unselectable in selection mode and undeletable in bulk delete

