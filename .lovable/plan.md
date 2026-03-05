

# Fix: Schedule Button with Calendar + Platform Selection

## Problem (2 issues)
1. The "Schedule" button directly sets `status: "scheduled"` without first setting `qa_status: "approved"`, causing the DB trigger `block_social_publish_without_qa` to reject the update with "Cannot schedule/publish: QA status must be approved first".
2. The Schedule button should open a full scheduling flow: calendar/datetime picker + platform selection, then confirm.

## Solution

### 1. Replace the Schedule button with a Popover-based scheduling flow

In `PostReviewPanel.tsx`, replace the simple `onSchedule` button (line 469) with a new `SchedulePopover` component that shows:

**Step 1 — Date & Time picker:**
- Calendar component for date selection
- Hour/minute dropdowns for time
- "Next" button to proceed

**Step 2 — Platform selection:**
- Checkbox list of platforms (Instagram, Facebook, LinkedIn, YouTube, TikTok)
- Pre-select the current post's platform
- User can select multiple platforms

**Step 3 — Confirm button:**
- Shows selected date/time and platforms summary
- On confirm: updates the post with `qa_status: "approved"`, `status: "scheduled"`, `scheduled_date`, and `platform`

### 2. Fix the `handleSchedule` in `SocialMediaManager.tsx`

Update `handleSchedule` (line 110-113) to also set `qa_status: "approved"` alongside `status: "scheduled"`. But this function will now receive date and platform from the popover, so the signature changes.

### 3. Remove the `onSchedule` prop dependency

Since the scheduling logic will now live entirely in `PostReviewPanel.tsx` (using `updatePost.mutate` directly with all needed fields), we no longer need the `onSchedule` callback from the parent. The confirm action in the popover will:

```typescript
updatePost.mutate({
  id: post.id,
  qa_status: "approved",
  status: "scheduled",
  scheduled_date: selectedDateTime.toISOString(),
  platform: selectedPlatform,
});
```

### Files to edit
1. **`src/components/social/PostReviewPanel.tsx`** — Replace the Schedule button with a `SchedulePopover` containing calendar + time + platform checkboxes + confirm
2. **`src/pages/SocialMediaManager.tsx`** — Update `handleSchedule` to include `qa_status: "approved"` (as fallback)

