

## Fix: Prevent Scheduling in the Past & Investigate Premature Publishing

### Problem Summary
1. A post was published at the wrong time — the cron job published it because `scheduled_date` was in the past (likely due to timezone mismatch or no past-time validation).
2. The calendar disables past **dates** but not past **times on today's date** — so a user can schedule a post for today at 6:30 AM when it's already 12:00 PM, and the cron immediately publishes it.
3. The `PostReviewPanel` "Schedule" button (line 639) uses `post.scheduled_date` directly with zero past-time validation.

### Root Cause
- **`SchedulePopover.tsx` (line 113)**: Calendar disables past dates, but when today is selected, any hour/minute is accepted — including past times.
- **`PostReviewPanel.tsx` (line 639)**: The Schedule button sends `post.scheduled_date` without checking if it's in the future.
- **`schedule-post/index.ts`**: The edge function accepts any `scheduled_date` without server-side past-time validation.
- **`social-cron-publish/index.ts` (line 34)**: `.lte("scheduled_date", now)` — any post with a past `scheduled_date` and status `scheduled` gets immediately published by the cron.

### Fix (3 layers of protection)

**1. `src/components/social/SchedulePopover.tsx`** — Block past times on confirm:
- In `handleConfirm`, after building `scheduledDateTime`, check if it's in the past. If so, show a toast error and return early.
```typescript
if (scheduledDateTime <= new Date()) {
  toast({ title: "Invalid time", description: "Cannot schedule in the past.", variant: "destructive" });
  return;
}
```

**2. `src/components/social/PostReviewPanel.tsx`** — Block past times on Schedule button:
- Before calling `schedulePost` (line 639), validate that `post.scheduled_date` is in the future. If not, show error toast and return.

**3. `supabase/functions/schedule-post/index.ts`** — Server-side guard:
- After parsing `scheduled_date`, reject if it's in the past:
```typescript
if (new Date(scheduled_date) <= new Date()) {
  return json({ error: "Cannot schedule a post in the past" }, 400);
}
```

This triple-layer approach ensures no post can ever be scheduled for a past time, preventing the cron from immediately picking it up and publishing it unexpectedly.

