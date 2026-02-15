

# Audit, Improve & Modify rebar.shop

## Audit Results (Live Scan)

The automated health check found **8 issues** across 24 pages, 9 posts, and 0 products (WooCommerce returned empty):

### CRITICAL (2 issues)
| Issue | Page | Impact |
|-------|------|--------|
| Duplicate slug `rebar-fabrication-2` | Page #20703 "Rebar Fabrication" | SEO authority split -- two identical pages competing |
| Duplicate slug `20579-2` | Page #20579 "Rebar AI Assistant" | Broken URL, SEO dilution |

Both pages serve identical content to their non-suffixed counterparts, splitting search authority.

### WARNING (6 issues)
| Issue | Page | Impact |
|-------|------|--------|
| Missing meta description | "My account" (#10) | Poor search snippets |
| Missing meta description | "Cart" (#8) | Poor search snippets |
| Missing meta description | "Shop" (#7) | Poor search snippets |
| Missing meta description | "Track Your Order" (#9281) | Poor search snippets |
| Missing meta description | "Blog" (#107) | Poor search snippets |
| No blog post in 130 days | Last post: Oct 2025 | Declining organic rankings |

### Additional Observations (from live scrape)
- Homepage links to `/rebar-fabrication-2/` instead of `/rebar-fabrication/` -- internal links point to the duplicate
- Some product images use lazy-load SVG placeholders that never load (broken below-the-fold images)
- "About Us" copy is keyword-stuffed with awkward transition words ("Moreover", "As a result", "Consequently" on every sentence)
- Footer only links to Facebook and Instagram -- missing LinkedIn, Google Business Profile

---

## Fix Plan

### 1. Fix Duplicate Slugs (Seomi -- Critical)

**Pages affected:** #20703 (`rebar-fabrication-2`) and #20579 (`20579-2`)

For each duplicate page:
- Use `wp_update_page` to change the slug to a unique, SEO-friendly value (e.g., `rebar-fabrication-toronto` for #20703)
- OR if the page is truly redundant (identical content), set its status to `draft` to remove it from indexing
- Update all internal links on the homepage that point to `-2` URLs to point to the canonical version

**File:** `supabase/functions/ai-agent/index.ts` -- no code changes needed, Seomi already has these tools

### 2. Add Meta Descriptions to 5 Pages (Seomi)

Use `wp_update_page` to set the `excerpt` field on each page:

| Page | Proposed Meta Description |
|------|--------------------------|
| Shop (#7) | "Browse custom rebar fabrication products -- stirrups, dowels, cages, and bend bars. CSA-certified. Same-day quotes. Ontario-wide delivery." |
| Cart (#8) | "Review your rebar order and proceed to checkout. Fast turnaround and Ontario-wide delivery from Rebar.Shop." |
| My Account (#10) | "Manage your Rebar.Shop account -- view orders, track deliveries, and update your profile." |
| Track Your Order (#9281) | "Track your rebar fabrication order status in real-time. Get delivery updates and estimated arrival times." |
| Blog (#107) | "Expert insights on rebar fabrication, construction reinforcement, and steel industry news from Rebar.Shop." |

### 3. Publish a Fresh Blog Post (Penn)

Create a new blog post to break the 130-day content silence. Topic suggestion:
- "2026 Rebar Fabrication Trends in Ontario" or "How to Choose the Right Rebar Size for Your Foundation"
- Use `wp_create_post` with status `draft` so you can review before publishing

### 4. Improve About Us Copy (Penn)

The current copy is over-optimized with forced transition words. Use `wp_update_page` on the About Us page to:
- Remove excessive "Moreover", "As a result", "Consequently" fillers
- Write natural, confident prose that still includes key phrases
- Keep existing heading structure intact (additive-only policy)

### 5. Fix Internal Links on Homepage (Commet)

The homepage links to `/rebar-fabrication-2/` in multiple places. After fixing the duplicate slug, use `wp_update_page` on the homepage to replace all `-2` references with the canonical URL.

### 6. Auto-Generate Suggestions on Schedule

The `generate-suggestions` function already calls `website-health-check` and creates agent suggestions with Fix/Decline buttons. No additional code changes needed -- this is already live.

---

## Technical Details

### No Code Changes Required

All the tools and infrastructure are already in place from the previous implementation:
- `website-health-check` edge function is deployed and returning results
- `generate-suggestions` integrates health check results into agent suggestions
- `AgentSuggestionCard` has Fix/Decline buttons for `wp_*` entity types
- All 6 agents (Seomi, Pixel, Prism, Buddy, Commet, Penn) have WP tools enabled

### Execution Approach

The fixes will be executed by sending commands to the agents through their chat interfaces:

1. **Navigate to `/agent/seo`** and instruct Seomi to:
   - Fix the two duplicate slugs
   - Add meta descriptions to the 5 pages

2. **Navigate to `/agent/copywriting`** and instruct Penn to:
   - Draft a new blog post
   - Improve the About Us page copy

3. **Navigate to `/agent/webbuilder`** and instruct Commet to:
   - Update homepage internal links after slug fixes

All changes will be logged to `wp_change_log` for audit trail and rollback capability.

### What Gets Fixed Immediately vs. Requires Your Approval

| Fix | Method | Approval |
|-----|--------|----------|
| Duplicate slugs | Agent updates via WP API | You confirm in agent chat |
| Meta descriptions | Agent updates via WP API | You confirm in agent chat |
| New blog post | Created as draft | You review and publish |
| About Us rewrite | Agent updates via WP API | You confirm in agent chat |
| Homepage link fixes | Agent updates via WP API | You confirm in agent chat |

