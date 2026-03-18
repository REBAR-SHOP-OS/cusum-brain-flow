

## Plan: Connect Wincher API and Pull All Data into SEO Module

### Step 1: Store the Wincher API Token

You have a Wincher Personal Access Token (from the screenshot). I will securely store it as `WINCHER_API_KEY` using the secrets tool, so it is available to backend functions.

### Step 2: Create Edge Function `wincher-sync`

A new edge function `supabase/functions/wincher-sync/index.ts` that calls the Wincher REST API (`https://api.wincher.com/v1`) with `Authorization: Bearer {token}`.

**Actions the function will support:**

| Action | Wincher Endpoint | What it pulls | Saves to |
|--------|-----------------|---------------|----------|
| `list_websites` | `GET /websites?include_ranking=true` | All websites with ranking summaries | `seo_domains` (wincher_json) |
| `list_keywords` | `GET /websites/{id}/keywords?include_ranking=true&limit=1000` | All keywords with positions, volume, CPC, difficulty, intent, traffic, SERP features, best position, ranking pages | `seo_keyword_ai` |
| `ranking_history` | `POST /websites/{id}/ranking-history` | Bulk historical position data (up to 2000 days) | `seo_domains` (wincher_rank_history_json) |
| `keyword_history` | `GET /websites/{id}/keyword/{kw_id}/ranking-history` | Per-keyword historical positions | `seo_keyword_ai` (position_history_json) |
| `list_competitors` | `GET /websites/{id}/competitors` | Competitor domains | `seo_domains` (wincher_competitors_json) |
| `competitor_summaries` | `GET /websites/{id}/competitors/ranking-summaries?include_ranking=true` | Competitor ranking data vs yours | `seo_domains` (wincher_competitors_json) |
| `competitor_positions` | `GET /websites/{id}/competitors/keyword-positions` | Competitor positions per keyword | `seo_domains` (wincher_competitors_json) |
| `list_serps` | `GET /websites/{id}/keywords/{kw_id}/serps` | SERP snapshots (top 10 results per keyword) | `seo_keyword_ai` (serp_json) |
| `list_groups` | `GET /websites/{id}/groups?include_ranking=true` | Keyword groups with rankings | stored as JSON |
| `list_annotations` | `GET /websites/{id}/annotations` | Timeline annotations | stored as JSON |
| `full_export` | All of the above in parallel | Everything | All tables |

The function will paginate through all keywords (using `limit` + `offset`) and handle 429 rate limits with retry backoff.

### Step 3: Database Migration

Add columns to store Wincher-specific data:

- `seo_domains`: `wincher_website_id` (integer), `wincher_data_json` (JSONB), `wincher_rank_history_json` (JSONB), `wincher_competitors_json` (JSONB), `wincher_groups_json` (JSONB), `wincher_annotations_json` (JSONB), `wincher_synced_at` (timestamptz)
- `seo_keyword_ai`: `wincher_keyword_id` (integer), `wincher_position` (integer), `wincher_position_change` (integer), `wincher_traffic` (numeric), `wincher_difficulty` (integer), `wincher_cpc` (numeric), `wincher_best_position` (integer), `wincher_serp_features_json` (JSONB), `wincher_ranking_pages_json` (JSONB), `wincher_position_history_json` (JSONB), `wincher_synced_at` (timestamptz)

### Step 4: Frontend Hook `useWincherSync`

New hook `src/hooks/useWincherSync.ts` with mutations:
- `syncAll` -- calls `full_export` action, pulls everything from Wincher in one click
- Progress toast notifications showing keyword count, history days pulled, etc.

### Step 5: Add Wincher Sync Button to SEO Overview

In `SeoOverview.tsx`, add a "Sync Wincher" button alongside the existing SEMrush sync button. This triggers the full export and shows progress.

### Step 6: Display Wincher Data in SEO Module

Enrich existing SEO views:
- **Keywords tab**: Show Wincher position, position change, difficulty, traffic, CPC, SERP features alongside existing data
- **Overview tab**: Show Wincher ranking trends (avg position, traffic, share of voice history charts)
- **Links tab**: Show competitor ranking comparisons from Wincher

### Data We Will Pull (complete list)

Per website:
- Domain ranking summary (avg position, traffic, traffic value, volume, share of voice + full history)
- Position distribution (1-3, 4-10, 11-20, 21-30)
- SERP feature ownership counts
- Keyword count history
- Competitors list + their ranking summaries + keyword positions

Per keyword (all of them, paginated):
- Current position + change + change_status
- Search volume + volume history
- CPC (high/low) + CPC history
- Keyword difficulty
- Search intents (NAVIGATIONAL, INFORMATIONAL, etc. with probabilities)
- Competition level
- Ranking pages (which URLs rank)
- SERP features (PAID, AI_OVERVIEW, LOCAL_PACK, etc.)
- Best position ever
- Historical position data (up to 2000 days back)

Per keyword SERP (top keywords):
- Full SERP snapshot: URLs, titles, descriptions, positions, traffic, SEO scores

Keyword groups with their aggregate rankings

Annotations (timeline events)

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/wincher-sync/index.ts` | Create |
| `src/hooks/useWincherSync.ts` | Create |
| `src/components/seo/SeoOverview.tsx` | Modify (add Wincher sync button) |
| `src/components/seo/SeoKeywords.tsx` | Modify (show Wincher columns) |
| Database migration | Add Wincher columns to `seo_domains` and `seo_keyword_ai` |

