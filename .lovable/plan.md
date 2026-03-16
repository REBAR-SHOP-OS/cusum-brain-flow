

# Fix: Date Change Must Move All Sibling Posts

## Problem
When changing a post's date in the review panel, only that single post's `scheduled_date` is updated. But the calendar groups posts by `${platform}_${title}` — so if there are 5 sibling posts (same title, same platform, different pages), the other 4 remain on the old date. The group card (×5) still appears on the old date because siblings weren't moved.

## Root Cause
The "Set Date" handler in `PostReviewPanel.tsx` (line 643-657) only updates the single post by ID:
```typescript
.update({ scheduled_date: date.toISOString() })
.eq("id", post.id)
```

It needs to update ALL sibling posts that share the same `title`, `platform`, and `scheduled_date` (original date).

## Fix

### `src/components/social/PostReviewPanel.tsx` — Update the `onSetDate` handler (~line 643)

Instead of updating only by `post.id`, update all posts matching the same `title` + `platform` + original `scheduled_date` (same day):

```typescript
onSetDate={async (date) => {
  // Update ALL siblings: same title + platform + same original day
  const originalDay = post.scheduled_date?.substring(0, 10);
  let query = supabase
    .from("social_posts")
    .update({ scheduled_date: date.toISOString() })
    .eq("platform", post.platform)
    .eq("title", post.title);

  if (originalDay) {
    query = query
      .gte("scheduled_date", `${originalDay}T00:00:00`)
      .lte("scheduled_date", `${originalDay}T23:59:59`);
  } else {
    query = query.eq("id", post.id);
  }

  const { error } = await query;
  if (error) { /* toast error */ return; }
  queryClient.invalidateQueries({ queryKey: ["social_posts"] });
  toast({ title: "Date updated", description: `All copies moved to ${format(date, "PPP p")}` });
}}
```

This ensures:
- All ×5 page variants move together to the new date
- The old date shows no remaining copies
- Only posts with the exact same title + platform + original scheduled day are affected

