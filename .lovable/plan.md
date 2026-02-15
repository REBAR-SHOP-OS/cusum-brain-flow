

# Rebar SEO Module -- Full Build Plan

## Overview

A standalone ERP module at `/seo` with its own sidebar navigation, 3 data source integrations, 7 new database tables, 3 edge functions, and 4 dashboard pages. No third-party SEO tools (Wincher/SEMrush) -- everything is built in-house using Google Search Console API, an internal crawler, and an optional SERP provider (DataForSEO).

---

## Module Architecture

```text
/seo (page)
  |-- Overview Dashboard (default)
  |-- Keywords (rank tracker)
  |-- Audit (site crawl results)
  |-- SEO Tasks (kanban board)
```

The module follows the same sidebar pattern as `/office` (OfficeSidebar) -- a dedicated left sidebar with section buttons, content area on the right.

---

## 1. Database Tables (7 new tables via migration)

| Table | Purpose |
|-------|---------|
| `seo_domains` | Registered domains to track (id, domain, gsc_verified, company_id, created_at) |
| `seo_keywords` | Keywords to track (id, domain_id, keyword, target_url, country, device, intent, tags[], active, created_at) |
| `seo_rank_history` | Daily rank snapshots (id, keyword_id, date, position, url_found, source, impressions, clicks, ctr, created_at) |
| `seo_crawl_runs` | Crawl audit snapshots (id, domain_id, status, pages_crawled, health_score, started_at, completed_at) |
| `seo_crawl_pages` | Individual page data per crawl (id, crawl_run_id, url, status_code, title, meta_description, h1, canonical, robots_directives, in_sitemap, redirect_target, issues_json, created_at) |
| `seo_issues` | Extracted issues from crawls (id, crawl_run_id, page_id, severity, issue_type, title, description, created_at) |
| `seo_tasks` | SEO-specific task board (id, domain_id, title, description, status, priority, entity_type, entity_url, linked_issue_id, assigned_to, company_id, created_at, updated_at) |

All tables include `company_id` for tenant isolation with RLS policies matching existing patterns (admin/office roles).

---

## 2. Edge Functions (3 new)

### A. `seo-gsc-sync` -- Google Search Console Data Import
- Uses existing Google OAuth tokens (already stored via `google-oauth` function with `webmasters.readonly` scope)
- Calls GSC API: `searchAnalytics.query` for queries, pages, impressions, clicks, avg position by date
- Upserts into `seo_rank_history` (source = 'gsc')
- Supports date range parameter (default: last 28 days)
- Scheduled via cron (daily)

### B. `seo-site-crawl` -- Internal Crawler
- Starts from sitemap.xml, discovers all indexable pages
- For each page: fetches HTML, extracts title, meta description, H1, canonical, robots meta, status code, redirects
- Cross-references against sitemap coverage
- Detects: broken links (4xx/5xx), duplicate titles/descriptions, missing H1, missing canonical, noindex on indexed pages
- Writes results to `seo_crawl_runs`, `seo_crawl_pages`, `seo_issues`
- Calculates health score (0-100) based on issue counts and severity weights

### C. `seo-rank-check` -- Optional SERP Provider
- Uses DataForSEO API (or SerpAPI as fallback) for real-time keyword position checks
- Checks specified keywords by country/device
- Stores daily position + ranking URL in `seo_rank_history` (source = 'serp')
- Requires `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` secrets (optional -- module works without it, falling back to GSC avg position)

---

## 3. Frontend Components

### A. `src/pages/SeoModule.tsx` -- Main page
- Registered at `/seo` route in App.tsx
- Contains `SeoSidebar` (like OfficeSidebar) + content area
- Sections: overview, keywords, audit, tasks

### B. `src/components/seo/SeoSidebar.tsx`
- Navigation: Overview, Keywords, Audit, Tasks
- Icons: BarChart3, Search, Bug, CheckSquare

### C. `src/components/seo/SeoOverview.tsx` -- Dashboard
- Health score trend chart (from `seo_crawl_runs`)
- Top 5 winners/losers keywords (biggest position change last 7d)
- Pages with biggest visibility change (impressions delta from GSC)
- Issues by severity (pie/bar from latest crawl)
- Quick stats: total keywords tracked, avg position, total issues

### D. `src/components/seo/SeoKeywords.tsx` -- Keyword Tracker
- Table: keyword, current position, change (delta), best, target URL, country, device, intent, tags
- Rank history sparkline or expandable chart per keyword
- Filters: country, device, intent, tags
- Add keyword form
- Alerts indicator (rank drop > 5 positions highlighted red)

### E. `src/components/seo/SeoAudit.tsx` -- Site Audit
- List of crawl runs with date, pages crawled, health score, status
- "Run Crawl" button triggers `seo-site-crawl`
- Expandable run showing issues grouped by severity (critical/warning/info)
- Issue types: broken_link, duplicate_title, duplicate_description, missing_h1, missing_canonical, missing_meta, noindex_conflict, redirect_chain, slow_page
- "Create Task" button on each issue (creates `seo_tasks` entry)

### F. `src/components/seo/SeoTasks.tsx` -- Kanban Board
- Columns: Open, In Progress, Done
- Cards show: title, severity badge, entity URL, assigned user
- Drag or dropdown to change status
- Filter by severity, entity type
- Linked back to issue/page

---

## 4. Routing and Navigation Updates

| File | Change |
|------|--------|
| `src/App.tsx` | Add `<Route path="/seo" element={<P><SeoModule /></P>} />` |
| `src/hooks/useActiveModule.ts` | Add `/seo` entry: `{ module: "SEO", moduleRoute: "/seo" }` |
| `src/components/layout/AppSidebar.tsx` | Add "SEO" nav item under "Office" group with Search icon, roles: `["admin", "office"]` |

---

## 5. Data Flow

```text
Daily cron:
  1. seo-gsc-sync -> pulls GSC data -> seo_rank_history (source='gsc')
  2. seo-rank-check (if SERP configured) -> checks keywords -> seo_rank_history (source='serp')
  3. seo-site-crawl (weekly or manual) -> crawls site -> seo_crawl_runs + seo_crawl_pages + seo_issues

Frontend reads:
  - seo_rank_history for keyword charts
  - seo_crawl_runs + seo_issues for audit dashboard
  - seo_tasks for kanban board
```

---

## 6. Secrets Needed

| Secret | Required? | Purpose |
|--------|-----------|---------|
| Google OAuth (existing) | Yes | GSC API access -- already connected |
| `DATAFORSEO_LOGIN` | Optional | DataForSEO SERP checks |
| `DATAFORSEO_PASSWORD` | Optional | DataForSEO SERP checks |

The module will work with GSC-only mode. SERP provider is additive.

---

## 7. Implementation Order

1. **Database migration**: Create all 7 tables with RLS policies
2. **Edge function `seo-gsc-sync`**: GSC data import
3. **Edge function `seo-site-crawl`**: Internal crawler
4. **Edge function `seo-rank-check`**: Optional SERP provider
5. **Frontend**: SeoModule page + sidebar + all 4 sub-pages
6. **Routing**: App.tsx, sidebar, breadcrumb updates
7. **Cron setup**: Daily GSC sync + optional SERP checks

---

## 8. Files Created/Modified

| File | Action |
|------|--------|
| `src/pages/SeoModule.tsx` | Create |
| `src/components/seo/SeoSidebar.tsx` | Create |
| `src/components/seo/SeoOverview.tsx` | Create |
| `src/components/seo/SeoKeywords.tsx` | Create |
| `src/components/seo/SeoAudit.tsx` | Create |
| `src/components/seo/SeoTasks.tsx` | Create |
| `supabase/functions/seo-gsc-sync/index.ts` | Create |
| `supabase/functions/seo-site-crawl/index.ts` | Create |
| `supabase/functions/seo-rank-check/index.ts` | Create |
| `src/App.tsx` | Modify (add route) |
| `src/hooks/useActiveModule.ts` | Modify (add SEO entry) |
| `src/components/layout/AppSidebar.tsx` | Modify (add nav item) |
| Database migration | 7 tables + RLS + realtime |

