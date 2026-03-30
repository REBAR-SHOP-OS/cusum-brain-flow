

# Fix Blank Hero on rebar.shop via WordPress API

## Root Cause
The **Slider Revolution 7** plugin JavaScript is failing to render slide content. The `<sr7-slide>` elements contain only empty `<sr7-bg>` tags — the JS that populates them with images, text, and CTAs never executes. This is a client-side JS initialization failure in the WordPress theme, not something fixable by editing slide data.

## Solution
Create an edge function that uses the WP REST API (write access) to **inject a static CSS/HTML hero fallback** into the homepage (page ID `13672`). This fallback will:
- Use the same banner images already uploaded to the media library
- Display a rotating hero with CSS-only animation (no JS dependency)
- Be placed **before** the Slider Revolution shortcode so content is always visible
- Include a `<noscript>` / CSS fallback that works even if all JS fails

## Implementation

### 1. New edge function: `supabase/functions/wp-fix-hero/index.ts`
- **GET** mode: Fetch page 13672 content, check if hero fallback already exists
- **POST** mode: Update page 13672 content to prepend a static HTML hero section

The static hero will:
- Use a full-width CSS image carousel with 8 banner images (already on the server)
- Auto-rotate via CSS `@keyframes` animation (no JS needed)
- Include fade transitions between slides
- Show the first image immediately (no loading delay)
- Be wrapped in a distinctive `<div id="rebar-static-hero">` for easy identification

### 2. Banner images to use (from the existing `image_lists`):
1. `rebar-estimation-banner-1920-vivid.webp`
2. `shop-drawings-ultra-hq-scaled.webp`
3. `rebar-detailing-high-quality-1.webp`
4. `dowel-rebar-blue-chalkboard.webp`
5. `spring_build_bonus_offer_sale.webp`
6. `rebar-stirrups-sale.webp`
7. `straight-rebar-sale-1.webp`
8. `custom_rebar_high_quality-1.webp`

### 3. Strategy for the page update
- Fetch current page content via `GET /pages/13672`
- Check if `rebar-static-hero` already exists (idempotent)
- Prepend the static hero HTML **before** the existing content
- Optionally wrap the Slider Revolution shortcode in a `display:none` div to prevent the empty 900px gap
- Update via `PUT /pages/13672`

### 4. Add a button/action in the Office or admin UI
- Add a "Fix Homepage Hero" action in the website management section so it can be triggered when needed

## Files Changed
- `supabase/functions/wp-fix-hero/index.ts` — new edge function to inject static hero
- One UI file (website management section) — button to trigger the fix

## Risk Assessment
- **Safe**: The WP REST API update is reversible (page revisions are kept)
- **Non-destructive**: Prepends content, does not delete existing slider
- **Idempotent**: Checks for existing fallback before inserting

