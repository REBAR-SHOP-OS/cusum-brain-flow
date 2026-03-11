

## Add Select All & Bulk Delete to Social Media Calendar

### What
Add a selection mode to the calendar view where users can select individual posts (via checkboxes) or use "Select All" to select all visible posts, then bulk delete them.

### Changes

**1. `src/pages/SocialMediaManager.tsx`**
- Add state: `selectedPostIds: Set<string>`, `selectionMode: boolean`
- Add a "Select" toggle button in the filter bar area that activates selection mode
- When selection mode is active, show:
  - "Select All" checkbox (toggles all `filteredPosts`)
  - Selected count badge
  - "Delete Selected" button (with confirmation dialog)
- Pass `selectedPostIds` and `onToggleSelect` to `SocialCalendar`
- Use `deletePost` from `useSocialPosts` to delete all selected posts
- Exit selection mode after deletion

**2. `src/components/social/SocialCalendar.tsx`**
- Add optional props: `selectedPostIds?: Set<string>`, `onToggleSelect?: (id: string) => void`
- When `onToggleSelect` is provided, render a small checkbox overlay on each post card
- Clicking the checkbox toggles selection (without opening the review panel)
- Selected posts get a highlighted border/ring

**3. Confirmation Dialog**
- Use existing `AlertDialog` component to confirm bulk deletion before executing

No database or backend changes needed — uses existing `deletePost` mutation.

