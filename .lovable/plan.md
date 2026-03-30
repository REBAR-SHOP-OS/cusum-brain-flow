

# Deduplicate Calendar Cards & Prevent Duplicate Publishing

## Problem
1. The calendar still shows many individual cards per platform per day — the grouping change consolidated by platform but each row in the DB is still a separate card. The screenshot shows ~7+ cards per day for Instagram alone because multiple posts exist with the same title/content for the same platform on the same day.
2. No guard exists to prevent publishing the same content to the same platform twice.

## Two Rules to Enforce

### Rule 1: Calendar shows max ONE card per platform per day (already grouped)
The `groupByPlatform` change is already in place. The screenshot suggests there are genuinely many separate posts per platform per day. The current code correctly groups them into one card with a "×N" badge. If individual cards still appear, it may be a rendering or caching issue. Will verify and ensure the consolidated view works.

### Rule 2: Prevent duplicate content from being published to the same platform

#### A. Backend Guard — `social-publish/index.ts` (line ~62-83)
Before publishing, check if a post with the same `title + platform + page_name` and `status = 'published'` already exists for the same day:

```typescript
// After the existing "already published" check for this specific post_id
if (post_id) {
  const { data: postData } = await supabaseAdmin
    .from("social_posts")
    .select("title, platform, page_name, scheduled_date")
    .eq("id", post_id)
    .maybeSingle();

  if (postData?.title) {
    const dayStart = postData.scheduled_date 
      ? new Date(postData.scheduled_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const { data: duplicate } = await supabaseAdmin
      .from("social_posts")
      .select("id")
      .eq("platform", postData.platform)
      .eq("title", postData.title)
      .eq("status", "published")
      .neq("id", post_id)
      .gte("scheduled_date", dayStart + "T00:00:00Z")
      .lte("scheduled_date", dayStart + "T23:59:59Z")
      .maybeSingle();

    if (duplicate) {
      return error 409: "Duplicate — this content was already published"
    }
  }
}
```

#### B. Backend Guard — `social-cron-publish/index.ts` (line ~63-70)
Same duplicate check before processing each due post in the cron loop.

#### C. Calendar Dedup — `SocialCalendar.tsx`
Add deduplication within each platform group: if multiple posts share the same `title + page_name`, only show one representative card (with a count). This collapses truly duplicate entries visually:

```typescript
function deduplicatePosts(posts: SocialPost[]): SocialPost[] {
  const seen = new Set<string>();
  return posts.filter(p => {
    const key = `${p.platform}_${p.title}_${p.page_name || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

Apply before rendering in the calendar: filter `dayPosts` through `deduplicatePosts` so duplicate titles on the same platform are collapsed.

## Files Changed
- `src/components/social/SocialCalendar.tsx` — add `deduplicatePosts` filter to remove duplicate title+page+platform entries per day
- `supabase/functions/social-publish/index.ts` — add duplicate content guard before publishing
- `supabase/functions/social-cron-publish/index.ts` — add duplicate content guard in cron loop

