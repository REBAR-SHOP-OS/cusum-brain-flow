

## Add "Repost" Button to PostReviewPanel

### What the user wants

A "Repost" button next to "Auto Generate Story" (line 695-698 area) that lets the user clone the current post's content and image to a new date — reusing the same visual on a different day.

### Implementation

**File**: `src/components/social/PostReviewPanel.tsx`

1. Add a "Repost" button after the "Auto Generate Story" button (line 699)
2. On click, open a date+time picker popover (reuse the same Calendar + hour/minute pattern from `SchedulePopover`)
3. On confirm, clone the post into a new `social_posts` row with:
   - Same `title`, `content`, `image_url`, `cover_image_url`, `hashtags`, `platform`, `page_name`, `content_type`, `user_id`
   - New `scheduled_date` from the picker
   - `status: "scheduled"`, `qa_status: "needs_review"`, `neel_approved: false`
4. Show toast on success: "Post reposted to {date}"
5. Import `Copy` icon from lucide-react for the button

### UI

```text
[ Auto Generate Story ]  [ 📋 Repost ]
```

Clicking "Repost" opens an inline popover with:
- Calendar date picker
- Hour + minute selects
- "Confirm Repost" button

### Files Changed

| File | Change | Category |
|---|---|---|
| `src/components/social/PostReviewPanel.tsx` | Add Repost button + date popover + clone logic | Safe additive |

### What is NOT changed
- No schema changes (uses existing columns)
- No edge function changes
- Original post is untouched — pure clone operation

