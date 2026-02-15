

# Optimize All Pictures on rebar.shop

## What This Will Do

The current image optimizer only adds `loading="lazy"` and `decoding="async"` HTML attributes. This plan enhances it to perform a more comprehensive optimization pass and then executes it live.

### Enhancements to wp-speed-optimizer

1. **Add width/height dimensions to images** -- The code already has `getImageDimensions()` and `detectDimensionsFromBytes()` functions but they are never called. Wire them up so every `<img>` tag without explicit `width`/`height` gets dimensions injected. This eliminates Cumulative Layout Shift (CLS).

2. **Add fetchpriority="high" to hero images** -- The first image (above-the-fold) currently skips lazy loading but doesn't get priority hints. Add `fetchpriority="high"` to signal the browser to load it first.

3. **Scan WooCommerce product short descriptions** -- Currently only `description` is scanned for products. Also process `short_description` which often contains images shown on category/shop pages.

4. **Media Library audit endpoint** -- Add a new section that scans the WP Media Library via REST API (`/wp/v2/media`) to report oversized images (over 500KB or dimensions over 2000px) that need server-side compression. These get surfaced as recommendations since actual compression requires a WP plugin.

### Execution

After deploying the enhanced function, trigger it with `dry_run: false` to apply all HTML-level optimizations immediately across all posts, pages, and products.

### What Cannot Be Done Remotely

Actual file compression (reducing JPEG/PNG file sizes) and WebP conversion require a WordPress plugin like **ShortPixel** or **Imagify** installed on the server. The media audit will identify which images need this treatment.

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/wp-speed-optimizer/index.ts` | Wire up `getImageDimensions()` to inject width/height; add `fetchpriority="high"` for hero images; scan product `short_description`; add media library audit section |
| `src/components/website/SpeedDashboard.tsx` | Add "Media Library" results display showing oversized images; add a one-click "Optimize All" button that runs with `dry_run: false` and shows confirmation |

### Optimizer Logic Changes

```text
For each <img> tag:
  1. If first image on page -> add fetchpriority="high" (already skips lazy)
  2. If not first image -> add loading="lazy" (existing)
  3. Add decoding="async" (existing)
  4. If missing width/height -> fetch image URL, detect dimensions, inject attributes
```

### Media Library Audit (new section)

```text
GET /wp/v2/media?per_page=100&media_type=image
For each image:
  - Check file size via source_url HEAD request
  - Flag if > 500KB or dimensions > 2000px
  - Report as "needs server-side compression"
  - Check if WebP version exists
```

### Deployment

The edge function will be auto-deployed and then called with `dry_run: false` to apply changes immediately. All modifications are logged to `wp_change_log` for audit trail and rollback capability.

