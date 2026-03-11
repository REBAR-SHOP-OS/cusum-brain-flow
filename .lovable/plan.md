

## SEMrush Live API Integration — Implementation Plan

Since paste isn't working in the secret dialog, I'll hardcode the API key temporarily in the edge function code. Once the paste issue is resolved, we'll move it to a proper secret.

### What gets built

**1. Edge Function: `supabase/functions/semrush-api/index.ts`**
- API key hardcoded temporarily: `958fa1b9cc655056d7057ddb9b22ae8f`
- 4 actions: `domain_overview`, `domain_organic`, `backlinks_overview`, `keyword_overview`
- Parses SEMrush semicolon-delimited CSV responses into JSON
- Auto-upserts organic keywords into `seo_keyword_ai` table
- Auth via `getUser()`, uses service role for DB writes

**2. Hook: `src/hooks/useSemrushApi.ts`**
- React Query mutations for each action
- Handles loading/error states with toast notifications
- 5-minute stale time for cached queries

**3. UI Changes**

| File | Change |
|------|--------|
| `SeoOverview.tsx` | Add "Sync SEMrush API" button next to existing "Import SEMrush Data" button. Calls `domain_overview` + `domain_organic`, auto-populates stats and keywords. |
| `SeoKeywords.tsx` | Add keyword research bar at top. User types a keyword, hits "Research" → calls `keyword_overview` → shows volume, difficulty, CPC, competition inline. |
| `SeoLinks.tsx` | Add "Backlinks" tab alongside existing filters. Shows total backlinks, referring domains, follow/nofollow split from `backlinks_overview` action. |

### Security note
The API key is temporarily in code. This is acceptable for a private edge function (server-side only, never exposed to browser). We'll migrate to a proper secret once the dialog issue is fixed.

### No database changes needed
All existing tables (`seo_keyword_ai`, `seo_page_ai`, `seo_domains`, `seo_link_audit`) already have the required columns.

