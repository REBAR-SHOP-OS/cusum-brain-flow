

## Use Pixel Agent's Brain for "Regenerate Image" Button

### Problem
The `regenerate-post` edge function uses a generic, simple prompt ("Create a professional, eye-catching social media image...") with a single model attempt and no logo overlay. This produces images that look nothing like what the Pixel agent generates.

### Solution
Rewrite `regenerate-post/index.ts` to use the exact same image generation pipeline as the Pixel agent:
- Same `VISUAL_STYLES_POOL` (12 photorealistic styles)
- Same `generatePixelImage()` retry pipeline (Flash → Flash → Pro fallback) with logo overlay
- Same `resolveLogoUrl()` and `extractImageFromAIResponse()` helpers
- **Caption-aware image prompt**: The image prompt will be built from the post's actual content/title so the image matches the caption
- Same mandatory photorealism rules, dedup logic, and diversity rules

### Changes

#### 1. Update `supabase/functions/regenerate-post/index.ts`

**Caption generation (step 2)** — Update the system prompt to:
- Generate content specifically for REBAR.SHOP (steel/construction industry)
- Include `image_text` field (short text overlay for the image, matching the caption theme)
- Include Persian translation fields (`captionFa`, `imageTextFa`)
- Include REBAR.SHOP contact info in caption
- Forbid exaggerated advertising words

**Image generation (step 3)** — Replace the simple single-shot call with:
1. Copy `VISUAL_STYLES_POOL`, `resolveLogoUrl()`, `extractImageFromAIResponse()`, and `generatePixelImage()` inline
2. Build the image prompt using the EXACT Pixel template:
   ```
   MANDATORY REALISM RULE + VISUAL STYLE: [random from 12] + 
   PRODUCT FOCUS (from post title) + THEME (from post content) + 
   MANDATORY text overlay + dedup from recent images + 
   forbidden styles + session seed + diversity rules
   ```
3. Fetch recent image names from `social-images/pixel/` for dedup
4. Use `generatePixelImage()` with logo overlay
5. Store result in `social-images/pixel/` bucket (same as Pixel agent)

**DB update (step 5)** — Also update `content` to include `---PERSIAN---` block and contact info, matching Pixel output format.

#### Files
- `supabase/functions/regenerate-post/index.ts` — Full rewrite of image generation logic to match Pixel agent

