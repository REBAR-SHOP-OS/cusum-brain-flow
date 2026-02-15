

# Fix rebar.shop Content Not Loading After Removing AirLift and JetPack

## Root Cause

After removing the **AirLift** plugin, images on rebar.shop are broken. The HTML shows all images using `bv-data-src` and `bv-data-srcset` attributes (from AirLift/Flavor optimization) instead of standard `src` and `srcset`. AirLift's JavaScript was responsible for swapping these at load time. Without it, browsers see only empty SVG placeholders and the page looks blank.

**This is a WordPress issue, not related to the chatbot code changes.**

## Evidence

Every image on the page looks like this:
```text
src="data:image/svg+xml,..." 
bv-data-src="https://www.rebar.shop/wp-content/uploads/..."
class="bv-tag-attr-replace bv-lazyload-tag-img"
```

The `bv-tag-attr-replace` and `bv-lazyload-tag-img` classes are AirLift markers. Without the AirLift JS, the real image URLs in `bv-data-src` never get loaded.

## Fix (WordPress Admin Steps)

These steps must be done in your **WordPress admin panel** (wp-admin):

### Step 1: Clean up AirLift image rewrites

Go to **wp-admin** and run a search-and-replace on your database (using a plugin like "Better Search Replace" or WP-CLI):

- Replace all `bv-data-src=` with `src=`
- Replace all `bv-data-srcset=` with `srcset=`
- Remove CSS classes `bv-tag-attr-replace` and `bv-lazyload-tag-img` from image tags

Alternatively, add this temporary JavaScript snippet to your theme's footer (Appearance > Theme File Editor > footer.php, before the closing body tag):

```text
<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[bv-data-src]').forEach(function(el) {
    el.setAttribute('src', el.getAttribute('bv-data-src'));
    var srcset = el.getAttribute('bv-data-srcset');
    if (srcset) el.setAttribute('srcset', srcset);
  });
});
</script>
```

This is a quick fix that makes images load immediately while you do a proper cleanup.

### Step 2: Clear all caches

- If using LiteSpeed or any cache plugin, purge all caches
- Clear CDN cache if applicable (e.g., Cloudflare)

### Step 3: Re-enable lazy loading properly

Install a standard lazy loading solution (most modern browsers support native `loading="lazy"` which is already in your markup). No extra plugin needed for basic lazy loading.

### Step 4: Restore image optimization (optional)

If you want image optimization back without AirLift, consider:
- **ShortPixel** or **Imagify** for image compression
- **Autoptimize** for CSS/JS minification

## Important Note

No changes are needed in the Lovable project. The chatbot widget embedded on rebar.shop is working correctly -- this is purely a WordPress plugin cleanup issue.

