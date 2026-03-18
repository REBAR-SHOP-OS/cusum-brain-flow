

## Plan: Remove Artificial Row Limits from SEO Module

### Problem
Multiple queries across the SEO module hit Supabase's default 1000-row limit or have explicit low limits, causing data truncation. With 1000+ tracked keywords, this silently drops data.

### Changes

**Frontend queries — add explicit high range limit (10,000):**

All these queries currently have NO `.limit()`, meaning Supabase caps at 1000 rows by default:

1. **`src/components/seo/SeoKeywords.tsx`** (~line 62-67) — `seo_keyword_ai` select all: add `.range(0, 9999)`
2. **`src/components/seo/SeoOverview.tsx`** (~line 94-97) — `seo_keyword_ai` stats query: add `.range(0, 9999)`
3. **`src/components/seo/SeoOverview.tsx`** (~line 121-124) — `seo_page_ai` stats query: add `.range(0, 9999)`
4. **`src/components/seo/SeoPages.tsx`** (~line 31-36) — `seo_page_ai` select all: add `.range(0, 9999)`
5. **`src/components/seo/SeoTasks.tsx`** (~line 47-51) — `seo_tasks` select all: add `.range(0, 9999)`

**Edge function limits to raise:**

6. **`supabase/functions/seo-rank-check/index.ts`** (line 51) — `.limit(100)` → `.limit(2000)` (allow checking all tracked keywords, not just 100)
7. **`supabase/functions/seo-ai-strategy/index.ts`** (line 48) — keywords `.limit(200)` → `.limit(5000)`
8. **`supabase/functions/seo-ai-strategy/index.ts`** (line 54) — pages `.limit(100)` → `.limit(5000)`

### Technical Note
Supabase's default response limit is 1000 rows. Using `.range(0, 9999)` explicitly requests up to 10,000 rows, overriding the default. For the strategy edge function, context sent to the LLM will be larger but within model token limits since it only selects relevant columns.

