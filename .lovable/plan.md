

# Fix: Stay on Card After Platform/Page Save

## Problem
When a user selects platforms or pages inside the review panel and clicks Save:
1. **Platform save**: If the original platform is removed, the current post row gets deleted from DB. Since `selectedPostId` still points to the deleted ID, `posts.find(p => p.id === selectedPostId)` returns `undefined` → panel closes.
2. **Page save**: Works but the card display may not update immediately because `page_name` on the selected post needs to reflect the new comma-separated value.

## Solution

### File: `src/components/social/PostReviewPanel.tsx`

1. **`handlePlatformsSaveMulti`** (line ~372): After creating new platform rows and deleting old ones, if the current `post.id` was among the deleted rows, call `onSelectNewPost(newId)` (a new callback prop) with the ID of one of the newly created rows so the parent updates `selectedPostId` to keep the panel open.

2. **`handlePagesSaveMulti`** (line ~457): Already works correctly (no row deletion), but ensure `setSubPanel(null)` returns to main panel view without closing the Sheet. No change needed here — just verify.

### File: `src/pages/SocialMediaManager.tsx`

3. Pass a new `onSelectNewPost` callback to `PostReviewPanel` that calls `setSelectedPostId(newId)` — this keeps the panel open on the new sibling post after the original is deleted during platform changes.

## Technical Detail
- In `handlePlatformsSaveMulti`: collect IDs from insert results. If `post.id` is in `toDelete`, call `onSelectNewPost` with the first new ID (or first remaining sibling ID).
- The `selectedPost` derivation (line 67-70 in SocialMediaManager) will then find the new post and keep the Sheet open.

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — update `handlePlatformsSaveMulti` to re-select a surviving post after platform change
- `src/pages/SocialMediaManager.tsx` — pass `onSelectNewPost` callback prop

