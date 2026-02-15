

# Fix All Speed Issues on rebar.shop

## Current Performance (from your PageSpeed reports)

| Metric | Mobile | Desktop | Target |
|--------|--------|---------|--------|
| TTFB | 3.2s | 3.5s | < 0.8s |
| FCP | 3.9s | 3.9s | < 1.8s |
| LCP | 4.3s | 4.4s | < 2.5s |
| CLS | 0.05 | 0.03 | < 0.1 (passing) |
| Core Web Vitals | FAILED | FAILED | Pass |

**Root cause**: The TTFB (Time to First Byte) at 3.2-3.5s accounts for ~80% of the delay. This means the WordPress server takes 3+ seconds just to start responding, before any content loads.

## What We Can Fix (via WordPress API)

Since we have full read/write access to rebar.shop via the WP REST API, here is what we can address:

### 1. Create a Speed Audit Edge Function

**New file: `supabase/functions/website-speed-audit/index.ts`**

A dedicated function that:
- Measures actual TTFB by timing a fetch to the homepage and key pages
- Scrapes the homepage HTML to identify speed-killing patterns
- Checks for unoptimized images (missing width/height, no lazy loading, oversized)
- Detects render-blocking resources in the page source
- Counts total page weight and number of requests
- Returns actionable findings with severity levels

### 2. Add Speed Checks to Existing Health Check

**File: `supabase/functions/website-health-check/index.ts`**

Add performance-related checks alongside existing SEO checks:
- Measure TTFB for homepage, a product page, and blog page
- Flag if TTFB exceeds 1.5s (warning) or 2.5s (critical)
- Check page content size (flag if homepage HTML > 200KB)
- Detect if pages embed large inline CSS/JS blocks
- Check for excessive post revisions that bloat the database

### 3. Content Optimization via WP API

**Executed through existing agent tools (no new code needed)**:
- Audit all published pages for oversized embedded images in post content
- Replace large inline images with properly sized versions using `wp_update_page`
- Remove unnecessary shortcodes or heavy page builder markup from key pages
- Trim excessive post revisions on high-traffic pages

### 4. Add Speed Recommendations to Agent Prompts

**File: `supabase/functions/ai-agent/index.ts`**

Update the **Commet (webbuilder)** and **Prism (data)** agent prompts to include speed awareness:
- Commet: When editing pages, always check content weight, image sizes, and recommend lazy loading
- Prism: Include TTFB and page load metrics in data analysis reports

### 5. Generate Speed-Specific Suggestions

**File: `supabase/functions/generate-suggestions/index.ts`**

Add speed audit results to the suggestion pipeline so Fix/Decline cards appear for:
- Slow TTFB (assigned to Commet/webbuilder)
- Heavy page content (assigned to Penn/copywriting to trim)
- Missing image optimization (assigned to Commet)

---

## What Requires Server-Side Action (recommendations only)

These cannot be fixed via the WP REST API but will be surfaced as critical recommendations:

| Issue | Fix Required | Who |
|-------|-------------|-----|
| **TTFB 3.2-3.5s** | Install a caching plugin (WP Super Cache, LiteSpeed Cache, or W3 Total Cache) | Server admin |
| **No page cache** | Enable full-page caching at the hosting level | Hosting provider |
| **No CDN** | Set up Cloudflare or similar CDN for static assets | Server admin |
| **PHP performance** | Enable OPcache, upgrade to PHP 8.2+ | Hosting provider |
| **Database bloat** | Clean post revisions, transients, spam comments | Server admin (or WP-Optimize plugin) |
| **Render-blocking CSS/JS** | Minify and defer non-critical JS, inline critical CSS | Autoptimize or similar plugin |
| **Image compression** | Install ShortPixel or Imagify for automatic WebP conversion | Server admin |

---

## Technical Details

### Speed Audit Function (`website-speed-audit/index.ts`)

```text
Input: None (audits rebar.shop automatically)
Output:
{
  "ok": true,
  "ttfb": { "homepage": 3200, "blog": 2800 },
  "page_weight": { "homepage_html_kb": 245 },
  "issues": [
    { "type": "slow_ttfb", "severity": "critical", ... },
    { "type": "heavy_page", "severity": "warning", ... },
    { "type": "unoptimized_images", "severity": "warning", ... }
  ],
  "recommendations": [
    { "action": "install_cache_plugin", "priority": 1, ... },
    { "action": "enable_cdn", "priority": 2, ... }
  ]
}
```

### Health Check Updates

Add after the existing product checks (line ~184):
- TTFB measurement using `performance.now()` around a fetch to the homepage
- Page content size check by fetching HTML and measuring byte length
- Image audit by scanning page content for `<img>` tags without `loading="lazy"` or missing dimensions

### Config Registration

Add `[functions.website-speed-audit]` with `verify_jwt = false` to `supabase/config.toml`.

## Files Modified
1. `supabase/functions/website-speed-audit/index.ts` -- NEW speed audit function
2. `supabase/functions/website-health-check/index.ts` -- add performance checks
3. `supabase/functions/ai-agent/index.ts` -- update Commet and Prism prompts for speed awareness
4. `supabase/functions/generate-suggestions/index.ts` -- add speed issues to suggestion pipeline
5. `supabase/config.toml` -- register new function

## Expected Outcome
- Automated speed monitoring with actionable Fix/Decline cards
- Content-level optimizations applied directly via WP API (trim heavy pages, optimize image references)
- Clear list of server-side recommendations you can share with your hosting provider
- Agents proactively flag speed regressions going forward

