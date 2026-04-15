

## Plan: Fix SEMrush Column Mapping + Add Missing Columns

### Root cause
The `semrush-api` edge function references ~14 columns that don't exist in the database. Every upsert silently fails. SEMrush charges API units but zero data is saved.

### Changes

#### Step 1: Database Migration — Add missing columns

**`seo_domains`** — add:
- `semrush_authority_score` (integer)
- `semrush_organic_keywords` (integer)
- `semrush_organic_traffic` (integer)
- `semrush_organic_cost` (numeric)
- `last_semrush_sync` (timestamptz)

**`seo_keyword_ai`** — add:
- `cpc` (numeric)
- `competition` (numeric)
- `traffic_pct` (numeric)
- `traffic_cost` (numeric)
- `results_count` (bigint)
- `keyword_difficulty` (numeric)
- `last_synced_at` (timestamptz)

#### Step 2: Fix column name mismatches in edge function

In `supabase/functions/semrush-api/index.ts`:
- `search_volume` → `volume` (seo_keyword_ai already has `volume`)
- `url` → `top_page` (seo_keyword_ai already has `top_page`)

These two fields exist but under different names. The edge function must use the correct column names.

#### Step 3: Redeploy edge function

After fixing the column references, redeploy so the next sync actually saves data.

### Expected result
- All SEMrush API calls will correctly persist data to the database
- No more wasted API units on silent failures
- Next fullExport will populate keywords, pages, backlinks, competitors, and rank history

### Cost note
The 4,000 units consumed today are lost — SEMrush doesn't refund. After this fix, re-running the sync will use another ~4,000 units but this time the data will actually be saved.

