

# Fix Pages/Platform/ContentType Save to Apply to All Sibling Posts

## Problem

When editing a card's Pages, Platform, or Content Type in the PostReviewPanel and clicking "Save", the change only updates the single `post.id` row. But the system represents grouped posts as separate DB rows per page (siblings sharing the same title + platform + scheduled day). So:

1. **Pages Save**: Currently does `updatePost({ id: post.id, page_name: values.join(", ") })` on one row. It should instead reconcile siblings — keep existing rows for still-selected pages, create new rows for newly added pages, and delete rows for deselected pages.

2. **Platform Save**: Currently updates only `post.id`. Should update all sibling rows.

3. **Content Type Save**: Currently updates only `post.id`. Should update all sibling rows.

## Changes

### File: `src/components/social/PostReviewPanel.tsx`

#### 1. Fix `handlePagesSaveMulti` — reconcile sibling rows

Replace the current single-row update with sibling reconciliation:
- Find all existing siblings (same title + platform + day)
- For each selected page: if a sibling row already exists for that page, keep it. If not, create a new row cloned from the current post.
- For each existing sibling whose page is no longer selected: delete it.
- Invalidate queries after all mutations complete.

#### 2. Fix `handlePlatformsSaveMulti` — batch update siblings

After setting the new platform on the primary post, also update all sibling rows (same title + old platform + day) to the new platform.

#### 3. Fix `handleContentTypeSave` — batch update siblings

After setting content_type on the primary post, also update all sibling rows (same title + platform + day) to the new content_type.

#### 4. Fix date update (already done)

The date update already uses a bulk Supabase query targeting all siblings — this is correct and serves as the reference pattern.

## Technical Details

```text
handlePagesSaveMulti(newPages):
  siblings = allPosts.filter(same title + platform + day)
  existingPages = siblings.map(s => s.page_name)
  
  pagesToAdd = newPages.filter(p => !existingPages.includes(p))
  pagesToRemove = siblings.filter(s => !newPages.includes(s.page_name))
  
  // Create new rows for added pages (clone from current post)
  for page in pagesToAdd:
    createPost({ ...post fields, page_name: page })
  
  // Delete rows for removed pages
  for sibling in pagesToRemove:
    deletePost(sibling.id)
  
  // Update remaining siblings if needed
  invalidateQueries()

handlePlatformsSaveMulti / handleContentTypeSave:
  Use direct supabase.from("social_posts").update(...)
    .eq("platform", post.platform)
    .eq("title", post.title)
    .gte/lte("scheduled_date", dayRange)
  Same pattern as the existing date bulk update.
```

**File to modify:** `src/components/social/PostReviewPanel.tsx` (3 handler functions)

