

## Group Posts by Platform in Calendar

### Problem
When multiple posts are scheduled on the same day across many accounts, individual cards clutter the view. The user wants posts sorted and grouped by platform, showing one card per platform with a count badge.

### Changes

**`src/components/social/SocialCalendar.tsx`**

1. Sort `dayPosts` by platform name so same-platform posts appear together
2. Group posts by platform into a `Map<string, SocialPost[]>`
3. Render one card per platform group showing:
   - Platform icon
   - Post title (from first post in group)
   - Count badge if >1 post (e.g. "×3")
   - Status (worst status takes priority)
4. Clicking the grouped card opens the first post; selection mode selects all posts in that platform group
5. `onSelectDay` and `onToggleSelect` work on all post IDs within the platform group

### UI Result
Instead of 7 separate cards (3 Instagram + 2 Facebook + 2 LinkedIn), the user sees 3 compact cards:
- Facebook (×2)
- Instagram (×3)  
- LinkedIn (×2)

Platform order: facebook, instagram, linkedin, twitter, tiktok, youtube.

