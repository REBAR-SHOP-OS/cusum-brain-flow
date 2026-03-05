

# Fix: Pixel Agent Image Display (Raw URL Instead of Inline Image)

## Problem
After adding video generation to the Pixel agent, the LLM's tool-call path outputs generated image URLs as plain text links instead of markdown image syntax (`![alt](url)`). The `PixelChatRenderer` regex only matches `![...](https://...social-images...)`, so the image never renders inline — the user sees a raw URL.

The **deterministic path** (slot number detection) still works fine because it constructs the markdown manually in code. The issue is only when the LLM uses the `generate_image` tool and then formats its own response.

## Root Cause
The marketing prompt (line 64) says `**Image** — markdown image tag` but the LLM inconsistently follows this. Adding the `generate_video` tool definition may have shifted the LLM's formatting behavior. The prompt needs to be more explicit about the exact format.

## Fix (2 parts)

### Part 1: Strengthen the prompt in `marketing.ts`
Add explicit formatting instructions after `generate_image` tool returns, telling the LLM exactly how to embed the image:

```
After generate_image returns a result with image_url, you MUST display it as:
![Product Name](IMAGE_URL_HERE)

NEVER paste the URL as plain text or a clickable link. Always use markdown image syntax.
```

Update lines 62-67 in `marketing.ts` to make the format crystal clear with an example.

### Part 2: Make `PixelChatRenderer` more robust
Update `extractPostData` in `PixelChatRenderer.tsx` to also detect plain URLs from the `social-images` bucket that aren't wrapped in markdown image syntax. If a bare URL is found, treat it as an image and render it in a `PixelPostCard` just like the markdown-wrapped ones.

Add a fallback regex:
```typescript
// Fallback: detect bare social-images URLs not in markdown image syntax
const bareUrlRegex = /(https?:\/\/[^\s)]*social-images[^\s)]*\.(?:png|jpg|jpeg|webp))/g;
```

If `imgRegex` finds nothing but `bareUrlRegex` does, use those URLs to build post cards.

### Part 3: Video display in `PixelChatRenderer`
Add detection for video URLs (from `social-media-assets` bucket or `.mp4` extension) and render them with a `<video>` element instead of an image card, so video generation also displays inline.

## Files to Edit
1. `supabase/functions/_shared/agents/marketing.ts` — Strengthen image format instructions
2. `src/components/social/PixelChatRenderer.tsx` — Add fallback bare URL detection + video rendering

