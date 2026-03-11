

## Fix: Preserve Scheduled Pages Per Calendar Card

### Problem
When a calendar card (grouped by platform + date/time) is clicked, the Pages dropdown should show all pages that are already scheduled for that group. Currently, when clicking a group card, `onGroupClick` collects `page_name` from sibling posts, but this collection happens at the platform level for the entire day, not scoped to the specific time slot. Single post clicks lose sibling page context entirely.

### Root Cause
In `SocialCalendar.tsx` line 154, the `uniquePages` is built from ALL posts in the platform group for that day, regardless of time. Posts scheduled at different times get mixed together. Also, when there's only one post in a group, no `groupPages` are passed.

### Fix

**File: `src/components/social/SocialCalendar.tsx`**

The grouping currently groups by platform only. The `uniquePages` passed to `onGroupClick` should come from the specific `posts` array of that platform group (which are already filtered to the same day). This part is actually correct — `posts` on line 154 refers to the platform group's posts for that day.

However, the real issue is that the same title/time posts across pages should be recognized as siblings. Update line 154 to use the local `posts` variable (the group's posts), which it already does. So the grouping is correct.

Let me re-examine what the user actually sees. The screenshot shows "Pages (1) Ontario Steel Detailing" — only one page. This means either:
1. `groupPages` isn't being passed (single post in group), OR  
2. Posts with same title but different pages are separate rows in DB with different `page_name` values, but the group only finds one.

**The actual fix**: When opening a card, find ALL sibling posts (same title, same platform, same scheduled_date) and populate their pages. Update `SocialCalendar.tsx` `onGroupClick` to pass pages from the matched posts:

**File: `src/components/social/SocialCalendar.tsx` (~line 154)**
- The `posts` variable already contains all posts for that platform on that day. The `uniquePages` collection is correct.
- But looking at the screenshot: both cards show "Declined" status with different platforms (Facebook and Instagram). When clicking one, only 1 page shows.

**File: `src/pages/SocialMediaManager.tsx` (~line 468)**  
- `onPostClick` sets `groupPages` to empty `[]`, losing page context for single-post groups.
- Fix: When clicking any card (even single post), look up all sibling posts with the same `title` and `scheduled_date` to find associated pages.

**File: `src/components/social/PostReviewPanel.tsx` (~line 182-192)**
- The `useEffect` falls back to `[post.page_name]` when `groupPages` is empty. 
- Add logic: if `groupPages` is empty but the post has siblings (same title + date + platform), query them and populate `localPages`.

### Implementation

1. **`SocialMediaManager.tsx`**: In the `onPostClick` handler (line 468), instead of setting `groupPages` to `[]`, find all posts with the same title and platform and scheduled_date from the `posts` array, extract their unique `page_name` values, and pass those as `groupPages`.

2. **`SocialCalendar.tsx`**: No changes needed — the existing `onGroupClick` already passes correct pages from the group.

3. **`PostReviewPanel.tsx`**: No changes needed if `SocialMediaManager` passes correct pages.

### Summary
Single change in `SocialMediaManager.tsx`: make `onPostClick` also compute and pass `groupPages` from sibling posts, so clicking any card preserves its scheduled page context.

