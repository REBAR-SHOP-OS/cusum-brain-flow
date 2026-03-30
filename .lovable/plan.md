

# Fix: Card Display and Platform Isolation

## Problems
1. Calendar cards show full page names (truncated) — user wants page **count** displayed as a number
2. Clicking a Facebook card opens the review panel showing "Instagram, Facebook" — should show only the clicked card's platform

## Root Cause

**Problem 1**: `SocialCalendar.tsx` line 220-222 renders `post.page_name` as text. Should show count instead.

**Problem 2**: `PostReviewPanel.tsx` lines 211-216 collects ALL sibling platforms matching `title + day`. When Facebook and Instagram cards share the same title and day, clicking either card shows both platforms.

## Solution

### File 1: `src/components/social/SocialCalendar.tsx`
**Line 220-222** — Show page count instead of full names:
```typescript
// From:
<p className="text-xs font-medium truncate">
  {post.page_name || (platform.charAt(0).toUpperCase() + platform.slice(1))}
</p>

// To:
<p className="text-xs font-medium truncate">
  {post.page_name
    ? `Pages (${post.page_name.split(", ").filter(Boolean).length})`
    : (platform.charAt(0).toUpperCase() + platform.slice(1))}
</p>
```

### File 2: `src/components/social/PostReviewPanel.tsx`
**Lines 211-216** — Only use the clicked post's own platform, not siblings:
```typescript
// From: collecting all sibling platforms by title+day
const siblingPlatforms = [...new Set(
  allPosts
    .filter(p => p.title === post.title && ...)
    .map(p => p.platform)
)];
setLocalPlatforms(siblingPlatforms.length > 0 ? siblingPlatforms : [post.platform]);

// To: just use the current post's platform
setLocalPlatforms([post.platform]);
```

## Result
- Cards show "Pages (6)" instead of "Ontario Steel Detailing, Rebar.shop, Ont..."
- Each card's platform icon remains correct (already working)
- Clicking a Facebook card opens review panel showing only "Facebook"
- Clicking an Instagram card opens review panel showing only "Instagram"

## Files Changed
- `src/components/social/SocialCalendar.tsx` — show page count on card
- `src/components/social/PostReviewPanel.tsx` — isolate platform to clicked card

