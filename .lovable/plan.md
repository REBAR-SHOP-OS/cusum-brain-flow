

# Fix rebar.shop Website Speed -- Automated Optimization

## Current Problem (from your PageSpeed reports)

| Metric | Mobile | Desktop | Target |
|--------|--------|---------|--------|
| TTFB | 3.2s | 3.5s | < 0.8s |
| FCP | 3.9s | 1.0s (lab) | < 1.8s |
| LCP | 4.3s | 4.4s / 1.1s (lab) | < 2.5s |
| CLS | 0.05 | 0.03 | < 0.1 |

Core Web Vitals: **FAILED** on both mobile and desktop.

The root cause is two-fold:
1. **Server-side TTFB (3.2-3.5s)** -- WordPress is slow to respond (no page caching, slow PHP/DB)
2. **Content-level issues** -- Images without lazy loading, missing dimensions, render-blocking CSS/JS chains

## What We Can Fix (and What We Cannot)

### Cannot fix from here (requires WordPress hosting/admin panel):
- Install caching plugin (LiteSpeed Cache, WP Super Cache)
- Upgrade PHP version / enable OPcache
- Set up Cloudflare CDN
- Install image compression plugin (ShortPixel/Imagify)

### CAN fix programmatically via WP REST API:
- Add `loading="lazy"` to all images in posts, pages, and products
- Add `width` and `height` attributes to images (prevents CLS)
- Add `decoding="async"` to images
- Convert image URLs to WebP where available
- Generate and inject critical resource preload hints
- Clean up excess inline styles in content

## Implementation Plan

### 1. New Edge Function: `wp-speed-optimizer`

A new backend function that scans and patches all WordPress content for speed optimizations.

**What it does:**
- Fetches all published posts, pages, and products via WP REST API
- Scans each content block for `<img>` tags
- For each image missing `loading="lazy"`, adds it (skipping above-the-fold hero images)
- For images missing `width`/`height`, fetches the image headers to detect dimensions and adds them
- For images missing `decoding="async"`, adds it
- Patches updated content back to WordPress via `wp_update_post` / `wp_update_page` / `wp_update_product`
- Returns a summary of all changes made

**Safety measures:**
- Dry-run mode by default (shows what would change without writing)
- Logs all changes to `wp_change_log` table for audit trail
- Only modifies content within `<img>` tags -- never touches other HTML

### 2. New Admin Chat Tool: `wp_optimize_speed`

Add a new tool to JARVIS (admin-chat) so you can say:
- "Optimize website speed" -- runs the optimizer
- "Run speed audit" -- calls the existing speed-audit function
- "Show speed report" -- fetches latest PageSpeed data

This is a **write tool** (requires confirmation) since it modifies WordPress content.

### 3. Speed Dashboard Panel in Website Manager

Add a "Speed" tab/section to the Website Manager page (`/website`) showing:
- Current TTFB, FCP, LCP, CLS metrics (from last audit)
- List of issues found with severity badges
- "Optimize Images" button that triggers the optimizer
- "Run Audit" button that triggers a fresh speed scan
- Server-side recommendations (caching, CDN, PHP) displayed as a checklist

### 4. Upgrade `website-speed-audit` Edge Function

Enhance the existing audit with:
- Google PageSpeed Insights API integration (real CrUX data instead of just TTFB measurement)
- Store audit results in a `speed_audit_results` table for trend tracking
- Add more granular image analysis (format detection, oversized images)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/wp-speed-optimizer/index.ts` | Create | Image optimization engine |
| `supabase/functions/admin-chat/index.ts` | Modify | Add `wp_optimize_speed` and `wp_run_speed_audit` tools |
| `supabase/functions/website-speed-audit/index.ts` | Modify | Add PageSpeed API, DB storage |
| `src/components/website/SpeedDashboard.tsx` | Create | Speed metrics UI panel |
| `src/pages/WebsiteManager.tsx` | Modify | Add speed dashboard tab |
| Database migration | Create | `speed_audit_results` table |

## Technical Details

### Image Optimization Logic

```text
For each post/page/product:
  1. Fetch content via WP REST API
  2. Parse all <img> tags with regex
  3. For each <img>:
     - If missing loading="lazy" AND not first image -> add it
     - If missing width/height -> HEAD request to image URL, parse dimensions
     - If missing decoding="async" -> add it
     - If src is .jpg/.png and .webp version exists -> swap src, add original as fallback
  4. If any changes made -> PATCH content back to WP
  5. Log changes to wp_change_log
```

### Speed Audit Storage

```text
Table: speed_audit_results
- id (uuid)
- audited_at (timestamptz)
- page_url (text)
- ttfb_ms (int)
- fcp_ms (int)
- lcp_ms (int)
- cls (float)
- performance_score (int)
- issues (jsonb)
- recommendations (jsonb)
```

### Admin Chat Integration

Two new tools added to JARVIS:

1. `wp_optimize_speed` (write tool, requires confirmation):
   - Runs the optimizer on all content
   - Returns summary of changes

2. `wp_run_speed_audit` (read tool):
   - Calls the speed audit function
   - Returns current metrics and issues

## Expected Impact

| Fix | Expected Improvement |
|-----|---------------------|
| Lazy loading on all images | LCP improvement ~0.5-1s on pages with many images |
| Image dimensions added | CLS reduced to near 0 |
| Decoding async | Smoother rendering, fewer layout shifts |
| Speed dashboard | Ongoing visibility into performance trends |

**Note:** The biggest win (TTFB from 3.5s to <0.8s) requires installing a caching plugin on the WordPress server. The dashboard will prominently display this as the #1 server-side recommendation with clear instructions.

