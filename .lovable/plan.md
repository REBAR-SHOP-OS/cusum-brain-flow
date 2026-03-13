

# Fix: Auto-Generate Must Include Company Logo (Like Pixel Agent)

## Problem
The `auto-generate-post` edge function generates images by sending a plain text prompt to the AI (line 335):
```
messages: [{ role: "user", content: post.image_prompt }]
```
No logo image is attached. The Pixel agent, by contrast, uses `resolveLogoUrl()` to fetch the logo from storage (`social-images/brand/company-logo.png`), attaches it as a multimodal image, and includes strict instructions to place it exactly as-is.

## Solution

### `supabase/functions/auto-generate-post/index.ts`

1. **Add `resolveLogoUrl()` function** — same as in `ai-agent/index.ts`: constructs the storage URL, does a HEAD check, returns URL or null.

2. **Fetch brain knowledge** (custom instructions + resource images) — same pattern as `regenerate-post/index.ts`: query `knowledge` table for social agent items, extract custom instructions and resource image URLs.

3. **Modify `generateAndUploadImage()`** to use multimodal content:
   - Attach logo image via `image_url` with strict placement instructions
   - Attach up to 3 brain resource images as visual references
   - Prepend custom instructions to the image prompt
   - Use the same retry pipeline pattern (try with logo → retry without if it fails)

4. **Call `resolveLogoUrl()` and fetch brain once** before the platform loop (not per-image), pass results into `generateAndUploadImage()`.

### Key code change in `generateAndUploadImage()`:
```typescript
// Before: simple text prompt
messages: [{ role: "user", content: post.image_prompt }]

// After: multimodal with logo + refs
const contentParts = [{ type: "text", text: fullPrompt }];
if (logoUrl) {
  contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
  contentParts.push({ type: "text", text: "CRITICAL: Place this logo EXACTLY as-is..." });
}
messages: [{ role: "user", content: contentParts }]
```

### Files
- `supabase/functions/auto-generate-post/index.ts` — add logo resolution, brain fetch, multimodal image generation

