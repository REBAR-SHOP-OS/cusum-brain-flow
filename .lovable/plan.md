

## SEMrush Live API Integration into SEO Manager

The user wants SEMrush API data displayed in the **SEO Manager** module (not Social Media Manager as previously discussed). The SEO Manager already has a robust structure with Dashboard, Keywords, Pages, Tasks, Links, and Copilot sections. Currently it imports SEMrush data via Excel uploads — we'll add **live API pulls**.

### Current State
- SEO Manager has 6 sections with existing data from `seo_keyword_ai`, `seo_page_ai`, `seo_insight`, `seo_tasks`, `seo_domains`
- SEMrush data currently imported via `.xlsx` file upload → `seo-semrush-import` edge function
- `SEMRUSH_API_KEY` secret is **not yet stored** (user provided key: `958fa1b9cc655056d7057ddb9b22ae8f`)

### Plan

**1. Store SEMrush API Key**
- Add `SEMRUSH_API_KEY` secret to project

**2. Create `semrush-api` Edge Function**
Single edge function at `supabase/functions/semrush-api/index.ts` supporting these actions:

| Action | SEMrush Endpoint | Returns |
|--------|-----------------|---------|
| `domain_overview` | `analytics/v1/?type=domain_ranks` | Authority score, organic/paid traffic, backlinks |
| `domain_organic` | `analytics/v1/?type=domain_organic` | Top organic keywords with position, volume, CPC |
| `backlinks_overview` | `analytics/v1/?type=backlinks_overview` | Total backlinks, referring domains, follow/nofollow |
| `keyword_overview` | `analytics/v1/?type=phrase_all` | Volume, difficulty, CPC for specific keywords |

- Authenticated, `verify_jwt = false`, validates user via `auth.getUser()`
- Parses SEMrush CSV responses into JSON
- Optionally auto-upserts results into existing `seo_keyword_ai` / `seo_page_ai` tables

**3. Add "Sync SEMrush" Button to Dashboard**
- Add a "Sync SEMrush API" button alongside existing "Import SEMrush Data" button in `SeoOverview.tsx`
- On click: calls `semrush-api` with `domain_overview` + `domain_organic` actions
- Auto-populates traffic stats, position tracking, and keyword data into existing tables
- Replaces the manual Excel upload workflow with one-click sync

**4. Add SEMrush Keyword Research to Keywords Tab**
- Add a "Research" input in `SeoKeywords.tsx` to look up new keywords via `keyword_overview` action
- Shows volume, difficulty, CPC, competition inline
- Option to add researched keywords to tracking

**5. Add Backlinks Section**
- Enhance `SeoLinks.tsx` with a "Backlinks" tab that pulls live data from `backlinks_overview`
- Shows total backlinks, referring domains, top anchors

**6. Create `useSemrushApi` Hook**
- `src/hooks/useSemrushApi.ts` — React Query wrapper for each action
- 5-minute stale time (SEMrush data doesn't change frequently)
- Handles loading/error states

### Files Changed
- **New**: `supabase/functions/semrush-api/index.ts` — API proxy edge function
- **Modified**: `supabase/config.toml` — add function config (verify_jwt = false)
- **New**: `src/hooks/useSemrushApi.ts` — React Query hook
- **Modified**: `src/components/seo/SeoOverview.tsx` — add "Sync SEMrush API" button
- **Modified**: `src/components/seo/SeoKeywords.tsx` — add keyword research input
- **Modified**: `src/components/seo/SeoLinks.tsx` — add backlinks display

