
# Grant Website Access to Selected Agents + Proactive Problem Reporting

## Overview
Give 6 circled agents (Pixel, Prism, Buddy, Commet, Penn, Seomi) full read/write access to rebar.shop via WordPress API tools, and build a proactive website health monitoring system that reports issues to you with **Fix** and **Decline** buttons.

## Selected Agents
- **Pixel** (Social Media) -- can check/update website content related to social integration
- **Prism** (Data & Insights) -- can audit site analytics, broken pages, performance
- **Buddy** (Business Development) -- can review landing pages, CTAs, competitive positioning
- **Commet** (Web Builder) -- already the web builder agent, needs WP tools
- **Penn** (Copywriting) -- can audit/improve website copy directly
- **Seomi** (SEO & Search) -- already has WP tools (no change needed)

## Changes

### 1. Extend WordPress Tools to 5 More Agents in `ai-agent`

**File: `supabase/functions/ai-agent/index.ts`**

Currently, WP tools (wp_list_posts, wp_list_pages, wp_get_post, wp_get_page, wp_list_products, wp_update_post, wp_update_page, wp_create_post, scrape_page) are only added when `agent === "seo"`. 

Change the condition from:
```typescript
...(agent === "seo" ? [ ...wpTools ] : [])
```
to:
```typescript
...((["seo","social","data","bizdev","webbuilder","copywriting"].includes(agent)) ? [ ...wpTools ] : [])
```

Similarly, expand the tool-call handler condition from `agent === "seo"` to the same set so all 6 agents can execute WP tool calls. Update the `wp_change_log` agent name to use the actual agent code instead of hardcoded "seomi".

### 2. Update Agent System Prompts

**File: `supabase/functions/ai-agent/index.ts`**

Add WordPress access instructions to 5 agent prompts (Seomi already has them):

- **Pixel**: Add section about checking rebar.shop for social media content alignment, verifying product pages match social campaigns
- **Prism**: Add section about website data auditing -- page inventory, broken content, publishing gaps
- **Buddy**: Add section about reviewing landing pages, CTAs, competitor positioning on the website
- **Commet**: Add full WordPress toolkit instructions (similar to Seomi but focused on content/design)
- **Penn**: Add section about auditing and improving website copy, headlines, CTAs, product descriptions

Each prompt addition will include:
- List of available WP tools
- Instruction to always read before writing
- Instruction to report problems proactively

### 3. Add Website Health Check to `generate-suggestions`

**File: `supabase/functions/generate-suggestions/index.ts`**

Add a new website health check section that runs during suggestion generation:
1. Fetch posts, pages, and products from rebar.shop via WPClient
2. Check for common issues:
   - Pages/posts with missing meta descriptions
   - Draft posts older than 30 days (stale drafts)
   - Products with no images or short descriptions
   - Pages with duplicate slugs or "-2" suffixes
   - Blog silence (no new post in 30+ days)
3. Create suggestions assigned to the appropriate agent:
   - SEO issues --> Seomi
   - Content quality issues --> Penn
   - Product page issues --> Commet
   - Social content gaps --> Pixel
   - Analytics concerns --> Prism
   - Business positioning --> Buddy

### 4. Add "Fix" and "Decline" Buttons to Suggestion Cards

**File: `src/components/agent/AgentSuggestionCard.tsx`**

For website-related suggestions (where `entity_type` starts with `"wp_"`):
- Replace the generic "Act" button with a **"Fix"** button (green, wrench icon) that navigates to `/website` and pre-loads the fix context
- Add a **"Decline"** button (red, X icon) that dismisses the suggestion with a reason field
- Keep "Snooze" as-is

### 5. Create `website-health-check` Edge Function

**New file: `supabase/functions/website-health-check/index.ts`**

A dedicated function that:
1. Uses WPClient to scan rebar.shop
2. Checks for common issues (missing meta, stale content, broken slugs, etc.)
3. Returns a structured report of issues found
4. Can be called by `generate-suggestions` or manually triggered

This keeps the health check logic reusable and doesn't bloat the suggestion generator.

### 6. Register New Function in Config

**File: `supabase/config.toml`**

Add `[functions.website-health-check]` with `verify_jwt = false`.

## Technical Details

### WordPress Tool Condition Change (ai-agent lines ~4162-4312)
```typescript
// Before:
...(agent === "seo" ? [ /* wp tools */ ] : [])

// After:
const WP_AGENTS = ["seo", "social", "data", "bizdev", "webbuilder", "copywriting"];
...(WP_AGENTS.includes(agent) ? [ /* wp tools */ ] : [])
```

### Tool Call Handler Expansion (ai-agent lines ~4399-4533)
```typescript
// Before:
if (agent === "seo" && tc.function?.name?.startsWith("wp_") || ...)

// After:
const WP_AGENTS = ["seo", "social", "data", "bizdev", "webbuilder", "copywriting"];
if (WP_AGENTS.includes(agent) && (tc.function?.name?.startsWith("wp_") || tc.function?.name === "scrape_page"))
```

### Suggestion Card "Fix" Button Logic
For `entity_type === "wp_post"` or `"wp_page"` or `"wp_product"`:
- "Fix" button navigates to `/website` and triggers the agent chat with the fix prompt
- "Decline" button marks suggestion as dismissed with status "declined"

### Website Health Check Issues Detected
| Issue | Assigned Agent | Severity |
|-------|---------------|----------|
| Missing meta description | Seomi | warning |
| Stale draft (30+ days) | Penn | info |
| Product missing image | Commet | warning |
| Duplicate slug (-2 suffix) | Seomi | critical |
| No blog post in 30+ days | Penn | warning |
| Landing page weak CTA | Buddy | info |
| Social content mismatch | Pixel | info |
| Page performance issue | Prism | warning |

## Files Modified
1. `supabase/functions/ai-agent/index.ts` -- expand WP tools + handlers to 6 agents, update prompts
2. `supabase/functions/generate-suggestions/index.ts` -- add website health check section
3. `src/components/agent/AgentSuggestionCard.tsx` -- add Fix/Decline buttons for WP suggestions
4. `supabase/functions/website-health-check/index.ts` -- new health check function
5. `supabase/config.toml` -- register new function
