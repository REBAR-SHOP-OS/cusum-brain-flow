
# Add App Builder and SEO Manager Cards -- Integrated with rebar.shop, ERP, and Odoo

## Overview

Add two new automation cards to the homepage Automations grid, fully wired into the existing ecosystem:

1. **App Builder** -- Routes to `/empire`, a new venture-building workspace integrated with ERP data (pipeline leads, Odoo CRM stages, order metrics) to ground venture planning in real business data.
2. **SEO Manager** -- Routes to the existing `/seo` module, which is already integrated with rebar.shop (WordPress API) and Google Search Console.

## What Changes

### 1. AutomationsSection.tsx -- Two New Cards

Add `Code` and `Search` icons from lucide-react. Expand the `color` type to include `"red"`. Expand the `icon` type to include `"code"` and `"search"`. Add two new entries to `defaultAutomations`:

- **App Builder**: red/orange gradient, Code icon, routes to `/empire`
- **SEO Manager**: teal gradient, Search icon, routes to `/seo`

### 2. New Page: `src/pages/EmpireBuilder.tsx`

A venture workspace with sections that pull live data from the ERP and Odoo:

- **Pipeline Integration**: Fetches active leads from `leads` table to show real deal flow alongside venture ideas. Ventures can be linked to pipeline stages.
- **Odoo CRM Data**: Reads from `odoo_leads` to show the current Odoo pipeline state (lead counts, stage distribution, revenue in pipeline) as context for market validation.
- **rebar.shop Metrics**: Pulls website performance from `seo_keywords_ai` and `seo_pages_ai` tables to inform the "Market Feedback" phase with real traffic/conversion data.
- **Order/Revenue Context**: Reads from `orders` table to show revenue trends, helping validate "Scale Engine" phase decisions with actual financial data.

The page has a Kanban board with 5 phases (Target Selection, Weapon Build, Market Feedback, Scale Engine, Empire Expansion) and an AI Architect button that sends venture data plus live ERP context to an edge function for analysis.

### 3. Database: `ventures` Table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| created_by | uuid | references auth.users, not null |
| company_id | uuid | references companies, ties to ERP |
| name | text | Venture name |
| vertical | text | Industry |
| phase | text | target_selection, weapon_build, market_feedback, scale_engine, empire_expansion |
| problem_statement | text | |
| target_customer | text | |
| value_multiplier | text | |
| competitive_notes | text | |
| mvp_scope | text | |
| distribution_plan | text | |
| metrics | jsonb | Activation, retention, WTP |
| revenue_model | text | |
| ai_analysis | jsonb | Latest AI stress-test |
| linked_lead_id | uuid | Optional FK to leads table -- links venture to a real pipeline deal |
| linked_order_ids | uuid[] | Optional array of order IDs for revenue tracking |
| odoo_context | jsonb | Snapshot of relevant Odoo pipeline data |
| status | text | active, paused, killed, won |
| notes | text | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: `created_by = auth.uid()` for all operations. Admin can see all.

### 4. Edge Function: `empire-architect`

Uses Lovable AI (google/gemini-3-flash-preview) to analyze ventures with real context:

- Accepts venture data plus optional ERP snapshots (pipeline summary, order revenue, SEO metrics, Odoo stage counts)
- Returns structured JSON: viability score, problem clarity, market size estimate, risks, next 3 actions, kill/continue recommendation
- Grounds the AI analysis in actual business data rather than abstract theory

### 5. Route in App.tsx

Add:
```
import EmpireBuilder from "./pages/EmpireBuilder";
// ...
<Route path="/empire" element={<P><EmpireBuilder /></P>} />
```

### 6. SEO Manager -- Already Integrated

The `/seo` route already exists and connects to:
- **rebar.shop**: Via WordPress API (WP_BASE_URL, WP_APP_PASSWORD) for content audits, meta tag updates, link fixes
- **Google Search Console**: Via GSC credentials for search performance data
- **ERP**: SEO tasks stored in `seo_tasks`, keywords in `seo_keywords_ai`, pages in `seo_pages_ai`

No changes needed for SEO -- just adding the automation card to make it visible on the home page.

## Integration Summary

```text
+------------------+     +------------------+     +------------------+
|   App Builder    |     |   SEO Manager    |     |  Job Site Mgr    |
|   (/empire)      |     |   (/seo)         |     |  (/website)      |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+---------+     +--------+---------+     +--------+---------+
| leads, orders,   |     | seo_keywords_ai, |     | WordPress API,   |
| odoo_leads,      |     | seo_pages_ai,    |     | WooCommerce,     |
| ventures (new)   |     | seo_tasks        |     | wp_change_log    |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                         +--------+---------+
                         |   rebar.shop     |
                         |   (WordPress)    |
                         +------------------+
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/integrations/AutomationsSection.tsx` | Add 2 cards, new icons, new color |
| `src/pages/EmpireBuilder.tsx` | New page with Kanban + ERP data hooks |
| `src/components/empire/EmpireBoard.tsx` | Kanban board component |
| `src/components/empire/VentureCard.tsx` | Draggable venture card |
| `src/components/empire/VentureDetail.tsx` | Detail panel with ERP context sections |
| `src/components/empire/NewVentureDialog.tsx` | Create venture dialog |
| `src/components/empire/AIStressTest.tsx` | AI analysis display |
| `supabase/functions/empire-architect/index.ts` | AI analysis edge function |
| `src/App.tsx` | Add `/empire` route |
| Database migration | Create `ventures` table with RLS |

## No External Dependencies

Uses existing UI components, Lovable AI gateway, and current database tables. No new packages needed.
