# Add "5 Stories" quick-create button

## Where
`src/pages/SocialMediaManager.tsx`, in the Quick Actions row right after the existing `Add Card` Popover (lines 372–400) — matches the circled spot in the screenshot.

## UI
- New icon-only button in a `Popover`, styled like the other quick actions but compact (square, same height ~h-12).
- Icon: `Clapperboard` from lucide-react (story/reel feel), with a small "5" badge or tooltip "Add 5 Story cards".
- Gradient: pink → orange (`from-pink-600 to-orange-500`) to distinguish from Add Card.
- Tooltip / `title="Create 5 Story cards on a date"`.

## Behavior
1. Click icon → Popover opens with `<Calendar mode="single" />` (same component used by Add Card).
2. On date select:
   - Resolve `user_id` from `posts[0]?.user_id` (same fallback as Add Card).
   - Build `scheduled = format(date, "yyyy-MM-dd'T'10:00:00")`.
   - Loop 5 times, calling `createPost.mutate(...)` with:
     - `platform: "unassigned"`
     - `status: "draft"`
     - `qa_status: "needs_review"`
     - `content_type: "story"`
     - `title: ""`, `content: ""`, `hashtags: []`, `neel_approved: false`
     - `scheduled_date: scheduled`
     - `user_id: user`
   - After the first successful insert: `setWeekStart(startOfWeek(date, { weekStartsOn: 1 }))` so the week jumps to the chosen date. Do NOT auto-open any of them (`setSelectedPostId` not called — 5 would conflict).
   - Close the popover (controlled `open` state).
3. Toast feedback already comes from `createPost` (one per insert). Acceptable; no extra toast added.

## Out of scope
- No backend/schema changes — `content_type: "story"` already exists (`PostReviewPanel.tsx:1031, 1726`).
- No changes to Add Card behavior.
- No content generation — cards are blank drafts, just like Add Card.

## Files touched
- `src/pages/SocialMediaManager.tsx` — add controlled `Popover` + button + handler (~25 lines).
