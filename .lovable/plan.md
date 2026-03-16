

# Video Posts: General Company Caption Instead of Product-Focused

## Problem
When a social post contains a video (`.mp4`), the caption is generated the same way as image posts — focused on a specific product. The user wants video post captions to be **general company/services promotional copy**, not product-specific. This applies to both:
1. **Caption-only regeneration** ("Regenerate caption" button)
2. **Full regeneration** (regenerate entire post)

## Changes

### 1. `supabase/functions/regenerate-post/index.ts`

**Caption-only mode (line ~306):** Detect if `post.image_url` ends with `.mp4` (video). If so, modify the prompt to instruct the AI to write a general company/services caption instead of describing the image content.

**Full regeneration mode (line ~378):** Same detection — if post has video, change the caption prompt to focus on general REBAR.SHOP services, brand, and company strengths rather than a specific product.

Add video detection around line 305:
```typescript
const isVideoPost = post.image_url && /\.(mp4|mov|webm)(\?|$)/i.test(post.image_url);
```

For caption-only mode, inject a video-specific instruction block:
```
If this post contains a VIDEO (not an image), write a GENERAL promotional caption about REBAR.SHOP as a company — our services, reliability, delivery, customer satisfaction, construction industry leadership in Ontario. Do NOT focus on any specific product. Write about the company brand, values, and services broadly.
```

For full regeneration mode, same instruction injected into the caption prompt.

### 2. `supabase/functions/auto-generate-post/index.ts`

No video posts are auto-generated here (only images), so no changes needed.

### 3. `src/components/social/PostReviewPanel.tsx`

Pass `is_video: isVideo` flag in the regenerate-post call body (line 574) so the edge function has explicit knowledge even if URL detection fails:
```typescript
body: { post_id: post.id, caption_only: true, is_video: isVideo },
```

Also for full regeneration call (~line 408).

