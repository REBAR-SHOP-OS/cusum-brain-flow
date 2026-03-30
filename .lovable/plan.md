

# Show All Cards in Calendar (Remove Deduplication Filter)

## Problem
The `deduplicatePosts` function on line 140 silently hides posts that share the same `title + page_name + platform`. The user wants every post visible and counted — no hidden entries.

## Change

### File: `src/components/social/SocialCalendar.tsx`

1. **Remove the `deduplicatePosts` call** on line 140 — use `dayPostsRaw` directly as `dayPosts`
2. **Keep the `deduplicatePosts` function** in the file (unused for now) in case it's needed later, or remove it entirely
3. The `groupByPlatform` consolidation stays — each platform still shows as one card per day, but the `×N` count will now reflect the **true total** of all posts, not a deduplicated subset

## Result
- All posts are counted and accessible (e.g., ×30 instead of ×15)
- Platform grouping remains (1 card per platform per day)
- Clicking a card opens the full group with every post visible

## Files Changed
- `src/components/social/SocialCalendar.tsx` — remove dedup filter, ~1 line change

