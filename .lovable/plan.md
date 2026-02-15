

# SEO Link Audit and Fix System

## Overview

Build a new edge function (`seo-link-audit`) that crawls all pages on rebar.shop, audits every link (internal and external), identifies issues, and proposes intelligent fixes -- including adding authoritative outbound links to RSIC (Reinforcing Steel Institute of Canada) resources where relevant.

The system will:
1. Crawl each page and extract all `<a>` tags (href, anchor text, rel attributes)
2. Identify broken internal links, missing anchor text, nofollow issues, and link gaps
3. Use AI to propose where to add RSIC outbound links based on page content context
4. Present results in a new "Link Audit" tab on the SEO dashboard
5. Allow one-click execution of fixes via the existing `seo-task-execute` infrastructure

## RSIC Link Mapping

The AI will intelligently match page content keywords to these authoritative RSIC resources:

| Content Keyword | RSIC Link | Anchor Text |
|----------------|-----------|-------------|
| "standard practice", "bar placing" | https://rebar.org/manual-of-standard-practice/ | Manual of Standard Practice |
| "reinforcing steel", "rebar industry" | https://rebar.org/ | Reinforcing Steel Institute of Canada |
| "certification", "quality assurance" | https://rebar.org/certification/ | RSIC Certification Program |
| "bar supports", "bar chairs" | https://rebar.org/bar-supports/ | RSIC Bar Supports Guide |
| "epoxy coated", "corrosion protection" | https://rebar.org/epoxy-coated-rebar/ | Epoxy-Coated Reinforcing Steel |
| "detailing", "bar bending schedule" | https://rebar.org/manual-of-standard-practice/ | Standard Detailing Practice |

## Changes

### 1. Database Migration

Add a new `seo_link_audit` table to store audit results per page:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid (PK) | Primary key |
| `domain_id` | uuid (FK) | Link to seo_domains |
| `page_url` | text | Page that was audited |
| `link_href` | text | The link URL found |
| `anchor_text` | text | Anchor text of the link |
| `link_type` | text | 'internal', 'external', 'rsic_opportunity' |
| `status` | text | 'ok', 'broken', 'missing_anchor', 'nofollow_issue', 'opportunity' |
| `suggestion` | text | AI-generated fix suggestion |
| `suggested_href` | text | Proposed corrected/new href |
| `suggested_anchor` | text | Proposed anchor text |
| `is_fixed` | boolean | Whether fix has been applied |
| `company_id` | uuid | Company ownership |
| `created_at` | timestamptz | Audit timestamp |

### 2. New Edge Function: `seo-link-audit`

Two-phase function similar to existing `seo-task-execute`:

**Phase "crawl":**
- Fetches all pages from WordPress (pages + posts + products)
- For each page, parses HTML and extracts all `<a>` tags
- Categorizes each link: internal, external, broken (4xx/5xx), missing anchor text
- Identifies content sections where RSIC links would be contextually relevant
- Uses AI (Lovable AI gateway) to match page content keywords to RSIC resources
- Stores all findings in `seo_link_audit` table
- Returns summary statistics

**Phase "fix":**
- Accepts a list of audit record IDs to fix
- For each fix:
  - If broken internal link: updates href to correct URL via WPClient
  - If RSIC opportunity: injects the link into page content at the contextually appropriate location via WPClient
  - If missing anchor text: updates the anchor text
- Logs all changes to `wp_change_log`
- Marks audit records as `is_fixed = true`

**AI Analysis Prompt:**
The AI receives page content (text) and a list of available RSIC resources. It identifies the best 1-3 places in the content where an RSIC link would be natural, authoritative, and SEO-beneficial. It avoids over-linking (max 2 RSIC links per page) and only links where the context genuinely discusses the topic.

### 3. Frontend: New "Links" Tab in SEO Module

Add a new tab in the SEO sidebar and a new component `SeoLinks.tsx`:

**Tab content:**
- Summary cards: Total Links Audited, Broken Links, RSIC Opportunities, Fixed
- "Run Link Audit" button to trigger the crawl phase
- Results table with columns: Page URL, Link, Type, Status, Suggestion, Action
- Each row with an "Apply Fix" button that calls the fix phase
- "Fix All" button to batch-apply all suggested fixes
- Filter by status: All, Broken, Opportunities, Fixed

### 4. Sidebar Update

Add a new nav item in `SeoSidebar.tsx`:
- Icon: `Link2`
- Label: "Links"
- Route: triggers the links tab

## Files to Create/Modify

| File | Change |
|------|--------|
| Database migration | Create `seo_link_audit` table |
| `supabase/functions/seo-link-audit/index.ts` | New edge function (crawl + fix phases) |
| `src/components/seo/SeoLinks.tsx` | New component for link audit UI |
| `src/components/seo/SeoSidebar.tsx` | Add "Links" nav item |
| `src/pages/Seo.tsx` | Add "links" tab rendering |
| `supabase/config.toml` | Register new edge function |

## Technical Notes

- The edge function uses `WPClient` to fetch page content and apply fixes
- AI analysis uses the Lovable AI gateway with structured tool-calling (same pattern as `seo-task-execute`)
- RSIC links are added with `rel="noopener noreferrer"` and `target="_blank"` for external links
- Maximum 2 RSIC outbound links per page to avoid over-optimization
- All WordPress content modifications are logged to `wp_change_log` for audit trail
- The crawl phase validates each link by making a HEAD request to check for 404s/redirects
- Internal links are checked against the site's own URL structure for consistency (www vs non-www, trailing slashes)

