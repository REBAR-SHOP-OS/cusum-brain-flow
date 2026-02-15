

# Rebar AI SEO Module -- Evolution Plan

Transform the existing crawler-based SEO module into an AI-first intelligence system. Data flows exclusively from GSC + GA; AI (via Lovable AI gateway) analyzes, scores, and generates actionable tasks.

---

## What Exists Today (Will Be Evolved)

- 7 DB tables: `seo_domains`, `seo_keywords`, `seo_rank_history`, `seo_crawl_runs`, `seo_crawl_pages`, `seo_issues`, `seo_tasks`
- 3 edge functions: `seo-gsc-sync`, `seo-site-crawl`, `seo-rank-check`
- 5 frontend components: `SeoOverview`, `SeoKeywords`, `SeoAudit`, `SeoTasks`, `SeoSidebar`

---

## 1. Database Changes

### New Tables

| Table | Purpose |
|-------|---------|
| `seo_keyword_ai` | AI-enriched keyword aggregates -- intent, topic cluster, trend/opportunity scores, 28d metrics |
| `seo_page_ai` | AI-enriched page aggregates -- GSC + GA combined metrics, speed score, CWV status, SEO score |
| `seo_insight` | AI-generated insights with explanation, confidence, entity linkage, and full AI reasoning payload |

### Altered Tables

| Table | Change |
|-------|--------|
| `seo_domains` | Add `verified_ga BOOLEAN DEFAULT FALSE`, `ga_property_id TEXT` |
| `seo_tasks` | Add `task_type TEXT`, `expected_impact TEXT`, `created_by TEXT DEFAULT 'manual'`, `ai_reasoning TEXT` |

### Table Schemas

**seo_keyword_ai:**
- id, domain_id, keyword, intent (informational/commercial/transactional/navigational)
- topic_cluster, impressions_28d, clicks_28d, ctr, avg_position
- trend_score (-100 to +100), opportunity_score (0-100)
- top_page, status (winner/stagnant/declining/opportunity)
- last_analyzed_at, company_id, created_at

**seo_page_ai:**
- id, domain_id, url
- impressions, clicks, ctr, avg_position (from GSC)
- sessions, engagement_rate, conversions, revenue (from GA)
- speed_score, cwv_status (good/needs_improvement/poor)
- seo_score (0-100), ai_recommendations JSONB
- last_analyzed_at, company_id, created_at

**seo_insight:**
- id, domain_id, entity_type (keyword/page), entity_id
- insight_type (opportunity/risk/win/action)
- explanation_text, confidence_score (0-1)
- ai_payload_json JSONB (full AI reasoning for audit trail)
- created_at, company_id

All tables get RLS policies scoped by company_id using the existing `has_role` pattern.

---

## 2. Edge Functions

### A. `seo-ai-analyze` (NEW -- Daily AI Analysis)

Orchestrates the full daily pipeline:
1. Pulls latest GSC data (queries + pages, 28d window) via GSC API
2. Pulls GA4 data (sessions, engagement, conversions per page) via GA4 Data API
3. Aggregates into `seo_keyword_ai` and `seo_page_ai` tables
4. Sends aggregated data to Lovable AI (Gemini) with a structured prompt asking it to:
   - Classify keyword intents
   - Score trend and opportunity per keyword
   - Detect winners, stagnation, drops
   - Cluster keywords by topic
   - Score each page's SEO health
   - Generate actionable insights
5. Uses tool calling to extract structured JSON output
6. Writes results to `seo_keyword_ai`, `seo_page_ai`, and `seo_insight`
7. Auto-creates `seo_tasks` for high-confidence opportunities

### B. `seo-ai-strategy` (NEW -- Weekly Strategy Job)

Deeper analysis run weekly:
1. Reads all keyword/page AI data
2. Prompts AI to identify strategic opportunities:
   - Keywords close to top 3
   - Rising impression keywords
   - Pages losing conversions due to speed
   - Content gaps
3. Generates SEO roadmap tasks with expected impact estimates
4. Creates tasks with `created_by = 'ai'` and `ai_reasoning` filled

### C. `seo-ai-copilot` (NEW -- On-Demand Chat)

Streaming AI copilot endpoint:
1. Accepts user question + context
2. Queries relevant `seo_keyword_ai`, `seo_page_ai`, `seo_insight` data
3. Sends to Lovable AI with system prompt instructing it to answer using only ERP SEO data
4. Streams response back via SSE
5. Handles questions like "Why did traffic drop?", "What should we optimize?", "Which products need SEO?"

### D. Existing Functions -- Modifications

| Function | Change |
|----------|--------|
| `seo-gsc-sync` | Keep as-is (still the raw data importer), but also update `seo_keyword_ai` aggregates after sync |
| `seo-site-crawl` | Keep as-is (crawler still useful for technical audit) |
| `seo-rank-check` | Keep as-is (optional SERP provider) |

---

## 3. Frontend -- Complete Rewrite of Sub-Pages

### A. `SeoSidebar.tsx` -- Updated Navigation

- Rename "Rebar SEO" to "Rebar AI SEO"
- Sections: **AI Dashboard**, **Keywords**, **Pages**, **Tasks**, **Copilot**
- Remove "Site Audit" as a top-level nav (fold into AI Dashboard health section)

### B. `SeoOverview.tsx` -- AI SEO Dashboard

- **Organic traffic + revenue** cards (from `seo_page_ai` aggregates)
- **Top AI Opportunities** list (from `seo_insight` where type = opportunity, sorted by confidence)
- **Active AI Tasks** count + recent list
- **Health Trend** chart (AI score over time from `seo_keyword_ai` averages)
- **Quick Actions**: "Run AI Analysis", "Sync GSC Data"
- No raw metric dumps -- everything is AI-curated

### C. `SeoKeywords.tsx` -- AI-Curated Keywords

- No raw keyword dump; sorted by AI opportunity score
- Columns: keyword, position, trend indicator, intent badge, topic cluster, opportunity score, status badge (winner/declining/stagnant)
- Expandable row shows: AI explanation, suggested actions, rank history chart
- Filters: intent, status, topic cluster, impact level
- "Optimize" button creates a task from AI recommendation

### D. `SeoPages.tsx` (NEW -- replaces SeoAudit as primary view)

- Pages sorted by SEO score and business impact
- Columns: URL, SEO score, impressions, clicks, sessions, engagement, conversions
- Inline AI recommendations per page (title rewrites, meta suggestions, internal linking)
- CWV status badges
- "Fix" button creates a task

### E. `SeoTasks.tsx` -- Enhanced Kanban

- Same kanban structure (Open/In Progress/Done)
- Cards now show: AI reasoning, expected impact, task type badge (content/technical/internal_link)
- Filter by task_type, created_by (AI vs manual)
- "created_by: AI" badge on auto-generated tasks

### F. `SeoCopilot.tsx` (NEW -- AI Chat)

- Streaming chat interface (similar to existing WebsiteChat pattern)
- Pre-built quick questions: "Why did traffic drop?", "What to optimize this week?", "Which products need SEO?"
- AI answers reference specific metrics from ERP tables
- Chat history stored in component state (not persisted)

---

## 4. Config Updates

| File | Change |
|------|--------|
| `supabase/config.toml` | Add entries for `seo-ai-analyze`, `seo-ai-strategy`, `seo-ai-copilot` with `verify_jwt = false` |
| `src/App.tsx` | No change needed (route already at `/seo`) |
| `src/hooks/useActiveModule.ts` | No change needed (already mapped) |
| `src/components/layout/AppSidebar.tsx` | No change needed (already has SEO nav item) |

---

## 5. AI Prompt Architecture

All AI calls go through Lovable AI gateway (`LOVABLE_API_KEY` already configured).

### Daily Analysis Prompt Structure
- System: "You are an SEO analyst for rebar.shop. Analyze the following GSC + GA data and produce structured insights."
- Uses tool calling to extract: keyword classifications, page scores, insights array, task suggestions
- Model: `google/gemini-3-flash-preview` (fast, cost-effective for daily runs)

### Strategy Prompt Structure  
- System: "You are a strategic SEO advisor. Identify the highest-impact opportunities from the following data."
- Model: `google/gemini-2.5-pro` (deeper reasoning for weekly strategy)

### Copilot Prompt Structure
- System: "You are an SEO copilot for the Rebar ERP. Answer questions using ONLY the provided SEO data. Reference specific metrics."
- Streaming via SSE
- Model: `google/gemini-3-flash-preview`

---

## 6. Implementation Order

1. Database migration (new tables + alter existing)
2. `seo-ai-analyze` edge function (daily pipeline)
3. `seo-ai-copilot` edge function (streaming chat)
4. `seo-ai-strategy` edge function (weekly)
5. Frontend: Rewrite all sub-pages + add new ones
6. Config.toml updates (auto-handled)

---

## 7. Files Summary

| File | Action |
|------|--------|
| Database migration | Create 3 tables, alter 2 |
| `supabase/functions/seo-ai-analyze/index.ts` | Create |
| `supabase/functions/seo-ai-strategy/index.ts` | Create |
| `supabase/functions/seo-ai-copilot/index.ts` | Create |
| `src/components/seo/SeoSidebar.tsx` | Rewrite (new nav items) |
| `src/components/seo/SeoOverview.tsx` | Rewrite (AI dashboard) |
| `src/components/seo/SeoKeywords.tsx` | Rewrite (AI-curated) |
| `src/components/seo/SeoAudit.tsx` | Delete (replaced by Pages) |
| `src/components/seo/SeoPages.tsx` | Create (AI page analysis) |
| `src/components/seo/SeoTasks.tsx` | Rewrite (enhanced with AI fields) |
| `src/components/seo/SeoCopilot.tsx` | Create (AI chat) |
| `src/pages/SeoModule.tsx` | Update (new sections) |

