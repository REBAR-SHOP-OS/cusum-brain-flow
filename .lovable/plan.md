

# Consolidate Calendar Cards: One Card Per Platform Per Day

## Problem
The calendar shows too many scattered cards because posts are grouped by `platform + title + page_name`. With multiple pages and titles, each day can have 10+ cards, making the view unusable (as shown in the screenshot).

## Rule
Each day column should show **one card per platform**, consolidating all posts for that platform into a single card. This limits cards to ~5-6 per day (one per active platform), keeping the view clean and organized.

## Changes

### File: `src/components/social/SocialCalendar.tsx`

1. **Rewrite `groupByPlatform`** to group by platform only (not title/page):
   ```typescript
   function groupByPlatform(posts: SocialPost[]) {
     const map = new Map<string, SocialPost[]>();
     for (const p of posts) {
       const key = p.platform || "other";
       if (!map.has(key)) map.set(key, []);
       map.get(key)!.push(p);
     }
     return [...map.entries()].sort(([a], [b]) => {
       return (PLATFORM_ORDER.indexOf(a) ?? 99) - (PLATFORM_ORDER.indexOf(b) ?? 99);
     });
   }
   ```

2. **Update the card rendering** to show consolidated info:
   - Platform icon + post count badge (e.g. "×6")
   - Show the number of unique pages (e.g. "3 pages")
   - Show dominant status across all posts in the group
   - Keep the existing click behavior (opens group dialog)

3. **Fix `platformName` extraction** — since key is now just the platform string, remove the `split("_")[0]` logic.

## Result
Each day column will have at most one card per platform (max ~7 cards), matching the user's requirement of organized, non-scattered display.

## Files Changed
- `src/components/social/SocialCalendar.tsx`

