

# Show Approved Posts When Clicking the Review Button

## Change

**`src/pages/SocialMediaManager.tsx`**:

1. **Rename the button** from `"{postsToReview} posts to review"` to something like `"{approvedCount} Approved posts"` — counting posts where `neel_approved === true`.
2. **On click**: set `statusFilter` to `"scheduled"` (which shows approved/scheduled posts) — or better, add a new filter value like `"approved_by_neel"` that filters posts by `neel_approved === true`.
3. **Add filtering logic**: When `statusFilter === "approved_by_neel"`, filter `filteredPosts` to only show posts where `neel_approved === true`, and display them in a card grid (similar to the pending approval card list already implemented).
4. **Update the count**: Change `postsToReview` to count `posts.filter(p => p.neel_approved).length`.

### Files Changed
- `src/pages/SocialMediaManager.tsx` — update button label, click handler, filter logic, and card list view

