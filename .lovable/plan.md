

## Plan: Remove 1,000 Keyword Cap — Fetch All SEO Data

### Problem
Database has **1,730 keywords** but the dashboard shows **1,000**. Supabase PostgREST enforces a server-side maximum of 1,000 rows per request. The `.range(0, 9999)` calls don't override this server limit — they still return only 1,000 rows.

### Fix
Create a shared paginated fetch utility that loops in batches of 1,000 until all rows are retrieved, then replace all `.range(0, 9999)` calls across SEO components with this utility.

### Changes

**1. New utility: `src/lib/supabasePaginatedFetch.ts`**
A helper function that:
- Accepts a Supabase query builder
- Fetches in pages of 1,000
- Concatenates all results
- Returns the full array

```typescript
export async function fetchAllRows(queryBuilder) {
  const PAGE = 1000;
  let all = [], page = 0, done = false;
  while (!done) {
    const { data } = await queryBuilder.range(page * PAGE, (page + 1) * PAGE - 1);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) done = true;
    page++;
  }
  return all;
}
```

**2. Update 4 files** — replace `.range(0, 9999)` with paginated fetch:

| File | Query |
|------|-------|
| `SeoOverview.tsx` line 96-100 | keyword stats (count, clicks, impressions) |
| `SeoOverview.tsx` line 124-128 | page stats |
| `SeoKeywords.tsx` line 254-259 | full keyword list |
| `SeoPages.tsx` line 46-50 | full pages list |
| `SeoTasks.tsx` line 70-74 | tasks list |

Each will use the paginated helper to fetch all rows regardless of count.

### Result
Dashboard will show the real count (1,730+) and all keywords, pages, and tasks will be fully loaded without any artificial cap.

