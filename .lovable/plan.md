

# Intelligent Keyword Source -- Multi-Channel Keyword Harvester

Build a new edge function and supporting infrastructure that collects keyword signals from **every data source in the ERP**, merges them with existing GSC/GA data, and uses AI to deduplicate, cluster, and score them into the `seo_keyword_ai` table.

---

## Problem

Currently, `seo_keyword_ai` only gets keywords from Google Search Console queries. The ERP has rich keyword signals sitting untapped in 8+ other tables.

---

## Data Sources to Harvest

| Source | Table | Fields Mined | Signal Type |
|--------|-------|-------------|-------------|
| Google Search Console | GSC API (existing) | queries | What people search to find you |
| Google Analytics | GA4 API (existing) | landing page titles, search terms | What pages attract traffic |
| Social Media Posts | `social_posts` | `content`, `hashtags`, `title` | What topics you publish about |
| Customer Emails | `communications` | `subject`, `body_preview`, `ai_category` | What customers ask about |
| Leads | `leads` | `title`, `description`, `source` | What prospects want |
| Quote Requests | `quote_requests` | `project_name`, `items` (JSONB), `notes` | Exact product demand |
| Orders | `orders` + `order_items` | product names, notes | What sells |
| Knowledge Base | `knowledge` | `title`, `content`, `category` | Internal expertise topics |
| WordPress Changes | `wp_change_log` | `entity_type`, page content changes | Content you already publish |
| Prospects | `prospects` | company info, industry signals | Market segments |

---

## Architecture

### 1. New Edge Function: `seo-keyword-harvest`

Pipeline:
1. Query all source tables (last 90 days of activity)
2. Extract raw keyword phrases from each source
3. Send combined phrases to Lovable AI (Gemini) with a structured prompt asking it to:
   - Deduplicate across sources
   - Normalize variations (e.g., "rebar cutting" vs "cut rebar")
   - Classify intent
   - Assign topic clusters
   - Score relevance and business value (0-100)
   - Tag which sources contributed to each keyword
4. Upsert results into `seo_keyword_ai` with new source tracking fields
5. Cross-reference against existing GSC data to enrich keywords that already have search metrics

### 2. Database Changes

**Alter `seo_keyword_ai`:**
- Add `sources TEXT[] DEFAULT '{}'` -- array of contributing source names (e.g., `['gsc','social','leads','orders']`)
- Add `source_count INTEGER DEFAULT 1` -- number of distinct sources (higher = more validated)
- Add `business_relevance NUMERIC DEFAULT 0` -- AI-scored business value separate from SEO opportunity
- Add `sample_context TEXT` -- example snippet showing where the keyword was found
- Add `harvested_at TIMESTAMPTZ` -- last time multi-source harvest ran

### 3. Frontend Changes

**Update `SeoKeywords.tsx`:**
- Add "Sources" column showing colored badges per source
- Add filter by source type
- Add "Source Count" sort option (keywords from more sources rank higher)
- Show "Business Relevance" score alongside SEO opportunity score
- Add tooltip showing sample context for each keyword

**Update `SeoOverview.tsx`:**
- Add "Keyword Sources" distribution chart (pie/bar showing how many keywords come from each source)
- Add "Cross-validated Keywords" stat card (keywords appearing in 3+ sources)

### 4. Integration into Existing Pipeline

- `seo-ai-analyze` calls `seo-keyword-harvest` at the beginning of its pipeline (or it can be triggered independently)
- The harvest runs before AI analysis so that all keywords are available for scoring
- New keywords from social/leads/orders that have NO GSC data get flagged as "content gap opportunities"

---

## AI Prompt Strategy

The harvest AI prompt will:
- Receive raw text snippets grouped by source
- Extract 2-4 word keyword phrases from natural language
- Deduplicate intelligently (not just exact match -- semantic similarity)
- Score each keyword on two axes: SEO potential and business relevance
- Output via tool calling for structured JSON

Model: `google/gemini-3-flash-preview` (fast, handles large text input)

---

## Implementation Order

1. Database migration: add new columns to `seo_keyword_ai`
2. Create `seo-keyword-harvest` edge function
3. Update `seo-ai-analyze` to call harvest first
4. Update `SeoKeywords.tsx` with source badges and filters
5. Update `SeoOverview.tsx` with source distribution chart

---

## Files Summary

| File | Action |
|------|--------|
| Database migration | Alter `seo_keyword_ai` (5 new columns) |
| `supabase/functions/seo-keyword-harvest/index.ts` | Create (multi-source keyword extraction pipeline) |
| `supabase/functions/seo-ai-analyze/index.ts` | Edit (call harvest at start of pipeline) |
| `src/components/seo/SeoKeywords.tsx` | Edit (source badges, filters, business relevance) |
| `src/components/seo/SeoOverview.tsx` | Edit (source distribution chart) |

---

## Technical Details

### Source Extraction Logic (in edge function)

```text
Social Posts --> extract from content + hashtags + title
Communications --> extract from subject lines + ai_category
Leads --> extract from title + description
Quote Requests --> extract from project_name + items JSON + notes
Orders/Items --> extract product names
Knowledge --> extract from title + category
WordPress --> extract from entity_type + page references
Prospects --> extract industry/company type signals
```

Each source provides raw text snippets (max 50 per source to stay within AI token limits). The AI then does the heavy lifting of phrase extraction and deduplication.

### New Column Details

- `sources`: e.g., `['gsc','social','leads','orders']` -- which systems contributed this keyword
- `source_count`: simple integer for fast sorting/filtering
- `business_relevance`: 0-100 score from AI -- how relevant is this keyword to revenue
- `sample_context`: e.g., "From lead: 'Need 20M rebar cutting for highway project'" -- shows proof
- `harvested_at`: timestamp of last multi-source harvest run

