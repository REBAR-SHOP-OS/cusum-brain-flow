

## Group Posts by Content & Prevent Duplicate Scheduling

### What changes

**1. Group same-content posts in calendar (`SocialCalendar.tsx`)**

Instead of showing separate cards for each platform, group posts that share the same `title + scheduled_date` (same day). Show ONE card per group with multiple platform icons stacked horizontally. Clicking opens the first post in the group.

Logic:
- For each day, group `dayPosts` by `title` (or `content` hash)
- Render one card per group with a row of platform icons (e.g. FB icon + IG icon)
- Show count per platform if multiple accounts (e.g. "Facebook ×2")
- Clicking the grouped card opens the first post; selection mode selects all posts in group

**2. Prevent duplicate scheduling (`schedule-post` edge function + frontend)**

Before scheduling, check if a post with the same `title`, `platform`, and `scheduled_date` already exists:
- In `schedulePost.ts` / `PostReviewPanel.tsx`: before calling schedule, query for existing posts matching `title + platform + date`
- If duplicate found, show a toast error and block the schedule
- In `schedule-post/index.ts` edge function: add server-side duplicate check before inserting clones

### Files Changed

| File | Change |
|------|--------|
| `src/components/social/SocialCalendar.tsx` | Group posts by title+day, show multi-platform icons on one card |
| `src/lib/schedulePost.ts` | Add duplicate check before scheduling |
| `supabase/functions/schedule-post/index.ts` | Server-side duplicate check before clone insert |

