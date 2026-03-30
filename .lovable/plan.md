

# Fix Existing Slider Revolution Hero on rebar.shop

## Analysis

The SR7 slider (data-id="6", alias="slider-1") is present on the page with 8 slides, and the `<image_lists>` element contains all 8 image URLs. However, the `<sr7-bg>` elements inside each slide are empty — the SR7 JavaScript fails to populate them with background images during initialization.

**Current `wp-fix-hero` injects a replacement hero and hides SR7. The user wants to fix SR7 itself.**

## Strategy

Rewrite `wp-fix-hero` to inject a **repair script** instead of a replacement hero. The script will:
1. Wait for the SR7 module to appear in DOM
2. Read image URLs from the existing `<image_lists>` element
3. Populate each empty `<sr7-slide > sr7-bg>` with the correct background image
4. If SR7 JS still fails after 3 seconds, apply the images as inline background styles directly

Additionally:
- Remove any previously injected static hero (`rebar-static-hero`) and the `display:none` CSS that hides SR7
- Add a "remove" action to clean up if needed

## Changes

### `supabase/functions/wp-fix-hero/index.ts`
- Replace `buildHeroHTML()` with `buildRepairScript()` that generates a `<script>` block
- The repair script logic:
  - On DOMContentLoaded, find `sr7-module` and its `image_lists > img` elements
  - Map each image `data-src` to the corresponding `sr7-slide > sr7-bg` (by index)
  - Set `style="background-image: url(...); background-size: cover; background-position: center;"` on each `sr7-bg`
  - Add a MutationObserver fallback: if SR7 JS clears/resets, reapply images
- Remove the `hideSR` CSS injection (no longer hiding SR7)
- Keep the inject/remove/GET actions with updated markers (`<!-- REBAR SR7 FIX -->`)
- Clean up any old static hero content during inject

### `src/components/website/WebsiteToolbar.tsx`
- Rename button label from "Fix Hero" to "Repair Slider" for clarity

## Repair Script Logic (pseudocode)
```text
<script>
document.addEventListener('DOMContentLoaded', function() {
  var mod = document.querySelector('sr7-module');
  if (!mod) return;
  var imgs = mod.querySelectorAll('image_lists img');
  var slides = mod.querySelectorAll('sr7-slide');
  imgs.forEach(function(img, i) {
    if (i < slides.length) {
      var bg = slides[i].querySelector('sr7-bg');
      if (bg && !bg.style.backgroundImage) {
        bg.style.backgroundImage = 'url(' + img.dataset.src + ')';
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
        bg.style.width = '100%';
        bg.style.height = '100%';
      }
    }
  });
  // Force first slide visible
  if (slides[0]) slides[0].style.opacity = '1';
});
</script>
```

## Files Changed
- `supabase/functions/wp-fix-hero/index.ts` — replace static hero injection with SR7 repair script injection
- `src/components/website/WebsiteToolbar.tsx` — update button label

