

# Add "Add Cart" Button to Social Media Calendar

## What
Add an "Add Cart" button (icon + date picker) next to the "Edit your Brand Kit" button in the quick actions bar. When the user picks a date, a blank draft post is created on that date and appears in the calendar.

## Changes

### `src/pages/SocialMediaManager.tsx`

1. Import `createPost` from `useSocialPosts` hook (line 52: add `createPost` to destructured values)
2. Import `useAuth` from `@/lib/auth` to get the user ID
3. Add `PlusSquare` to lucide imports
4. After the "Edit your Brand Kit" button (line 326), add a new "Add Cart" button with a Popover containing a Calendar date picker
5. On date select: call `createPost.mutate()` with a blank post (`platform: "unassigned"`, `status: "draft"`, `scheduled_date: selected date`, empty title/content) and navigate the calendar to that week

```text
[Approved posts] [Brand Kit] [+ Add Cart]
                                   └─ Popover with Calendar
                                      └─ Select date → create blank post
```

### Implementation detail
- Button styled similarly to existing quick action buttons (gradient pill)
- Uses existing `Calendar` component inside a `Popover`
- On date selection: creates a draft post, sets `weekStart` to that week, and opens the new post for editing

