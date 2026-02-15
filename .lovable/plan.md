

# Update SEO Module with New SEMrush Data

## Overview

Import three new SEMrush data sources into the existing SEO module:
1. **Ideas XLSX** (updated version) -- same format as before, re-import with latest data
2. **Mega Export XLSX** -- site audit with ~100 issue categories per page URL (broken links, missing titles, etc.)
3. **Position Tracking PDF** -- keyword rankings, visibility (72.62%), avg position (6.99), top 3/10 counts, SERP features

The traffic summary screenshot is the same as before (Jan 2026: 1.2K visits, 57.55% bounce rate).

## Changes

### 1. Database Migration

Add new columns to `seo_domains` for position tracking metrics:

| Column | Type | Purpose |
|--------|------|---------|
| `visibility_pct` | numeric | 72.62% |
| `estimated_traffic_pct` | numeric | 0.16% |
| `avg_position` | numeric | 6.99 |
| `top3_keywords` | integer | 17 |
| `top10_keywords` | integer | 19 |
| `total_tracked_keywords` | integer | 20 |
| `position_tracking_date` | text | "2026-02-15" |

Add `issues_json` column to `seo_page_ai` (missing -- the edge function was trying to write to it):

| Column | Type | Purpose |
|--------|------|---------|
| `issues_json` | jsonb | Stores per-page audit issues from mega export |

### 2. Update Edge Function `seo-semrush-import`

Extend to accept two additional data sections:

- **`audit_pages`** -- Array of `{ url, issues: { broken_internal_links: 2, missing_h1: 1, ... } }` parsed from the mega export. Upserts into `seo_page_ai` with the `issues_json` column and computes `seo_score` based on total issue count.
- **`position_tracking`** -- Object with visibility, avg position, top 3/10 counts. Updates the new `seo_domains` columns.

### 3. Update Frontend `SeoOverview.tsx`

- **Enhance the import button** to accept multiple files at once (ideas XLSX + mega export XLSX).
- **Parse mega export** client-side: extract page URLs and count non-zero issues per page, send as `audit_pages` array.
- **Hard-code position tracking data** from the PDF into the import payload (visibility: 72.62%, avg position: 6.99, top3: 17, top10: 19, total: 20).
- **Add Position Tracking card** below the Traffic Summary card showing visibility, avg position, top 3/10 keyword counts.
- **Update traffic data** to match the screenshot (same as before -- already hard-coded).

### 4. Trigger the import

After code changes, the user clicks "Import SEMrush" and selects both XLSX files. The system will:
- Detect which file is the ideas report vs the mega export by checking column headers
- Parse both and send combined payload to the edge function
- Display success toast with counts

## Technical Details

### Database Migration SQL

```sql
ALTER TABLE public.seo_domains
  ADD COLUMN IF NOT EXISTS visibility_pct numeric,
  ADD COLUMN IF NOT EXISTS estimated_traffic_pct numeric,
  ADD COLUMN IF NOT EXISTS avg_position numeric,
  ADD COLUMN IF NOT EXISTS top3_keywords integer,
  ADD COLUMN IF NOT EXISTS top10_keywords integer,
  ADD COLUMN IF NOT EXISTS total_tracked_keywords integer,
  ADD COLUMN IF NOT EXISTS position_tracking_date text;

ALTER TABLE public.seo_page_ai
  ADD COLUMN IF NOT EXISTS issues_json jsonb;
```

### Edge Function Changes

Accept new body fields:
```json
{
  "domain_id": "uuid",
  "ideas": [...],
  "traffic": {...},
  "audit_pages": [
    { "url": "https://rebar.shop/about/", "issues": { "missing_h1": 1, "broken_internal_links": 2 }, "total_issues": 3 }
  ],
  "position_tracking": {
    "visibility_pct": 72.62,
    "estimated_traffic_pct": 0.16,
    "avg_position": 6.99,
    "top3_keywords": 17,
    "top10_keywords": 19,
    "total_tracked_keywords": 20,
    "date": "2026-02-15"
  }
}
```

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/seo-semrush-import/index.ts` | Add audit_pages and position_tracking processing |
| `src/components/seo/SeoOverview.tsx` | Multi-file upload, mega export parsing, position tracking card, hard-coded PDF data |

### Frontend Mega Export Parsing Logic

The mega export has ~100 issue columns. Client-side parsing will:
1. Read column headers from row 1
2. For each page URL row, count columns with non-zero values
3. Build an issues object with only non-zero issue types
4. Filter out pages with zero total issues to reduce payload size

