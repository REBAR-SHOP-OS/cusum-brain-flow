

# Import SEMrush Data into SEO Module

## What We Have

The uploaded files contain two sets of SEMrush data for rebar.shop:

1. **XLSX "Ideas" report** -- ~90+ rows with columns: Priority, URL, Keyword, Idea (issue/recommendation text)
2. **Traffic Summary screenshot** -- Jan 2026 stats: 1.2K visits (+77.52%), 1.2K unique visitors (+66.71%), 3.3 pages/visit, 02:16 avg duration, 57.55% bounce rate

## Plan

### 1. Add traffic summary fields to `seo_domains` table

Add columns to store the SEMrush traffic overview data directly on the domain record:

| Column | Type | Purpose |
|--------|------|---------|
| `visits_monthly` | integer | 1,200 |
| `unique_visitors_monthly` | integer | 1,200 |
| `pages_per_visit` | numeric | 3.3 |
| `avg_visit_duration_seconds` | integer | 136 (2:16) |
| `bounce_rate` | numeric | 57.55 |
| `visits_change_pct` | numeric | 77.52 |
| `visitors_change_pct` | numeric | 66.71 |
| `traffic_snapshot_month` | text | "2026-01" |

### 2. Create edge function `seo-semrush-import`

An edge function that accepts the parsed SEMrush data and upserts it into:

- **`seo_keyword_ai`** -- Each unique keyword from the XLSX, with `sources: ['seo_tools']`, `top_page` set to the URL, `opportunity_score` from Priority column, `status: 'opportunity'`
- **`seo_page_ai`** -- Each unique URL from the XLSX, upserted with issue count data
- **`seo_insight`** -- Each "Idea" text becomes an insight with `insight_type: 'action'` or `'risk'`, linked to the keyword/page entity
- **`seo_domains`** -- Updates the traffic summary fields from the summary data

The function will deduplicate keywords (same keyword appearing with multiple ideas) and pages (same URL with multiple issues).

### 3. Add "Import SEMrush Data" button to SEO Overview

Add an upload button on the SEO dashboard that:
- Accepts `.xlsx` files
- Parses the file client-side using a lightweight parser
- Sends the parsed rows + traffic summary to the `seo-semrush-import` edge function
- Shows a toast with import results

Also add a traffic summary card to the overview showing the SEMrush stats (visits, bounce rate, etc.) when available.

### 4. Hard-code the traffic summary from the screenshot

Since the screenshot data can't be auto-extracted from the XLSX, we'll include the traffic stats as part of the import call with pre-filled values from the screenshot, or add a small form for the user to enter them.

## Technical Details

### Database Migration

```sql
ALTER TABLE seo_domains 
  ADD COLUMN visits_monthly integer,
  ADD COLUMN unique_visitors_monthly integer,
  ADD COLUMN pages_per_visit numeric,
  ADD COLUMN avg_visit_duration_seconds integer,
  ADD COLUMN bounce_rate numeric,
  ADD COLUMN visits_change_pct numeric,
  ADD COLUMN visitors_change_pct numeric,
  ADD COLUMN traffic_snapshot_month text;
```

### Edge Function: `seo-semrush-import`

Accepts JSON body:
```json
{
  "domain_id": "uuid",
  "ideas": [
    { "priority": 3.03, "url": "...", "keyword": "...", "idea": "..." }
  ],
  "traffic": {
    "visits": 1200, "unique_visitors": 1200,
    "pages_per_visit": 3.3, "avg_duration_seconds": 136,
    "bounce_rate": 57.55, "visits_change_pct": 77.52,
    "visitors_change_pct": 66.71, "month": "2026-01"
  }
}
```

### Files Modified/Created

| File | Change |
|------|--------|
| `supabase/functions/seo-semrush-import/index.ts` | New edge function for importing data |
| `src/components/seo/SeoOverview.tsx` | Add "Import SEMrush" button + traffic summary card |

### Client-side XLSX Parsing

Use the already-installed `@zip.js/zip.js` or parse XLSX manually (XLSX is a ZIP of XML files). Alternatively, parse the XLSX in the edge function. The simplest approach: parse client-side, extract the 4 columns, send as JSON to the edge function.

