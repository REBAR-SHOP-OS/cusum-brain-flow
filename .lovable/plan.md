

# Fix: Regenerated Images Must Never Be Duplicates

## Problem
When "Regenerate image" is clicked, the current dedup logic only checks recent file **names** for style indices. It does not compare the **actual current image** of the post being regenerated, nor does it pass the current image to the AI as a negative reference. The AI can produce visually similar or identical images.

## Solution
Strengthen dedup in `supabase/functions/regenerate-post/index.ts` with two changes:

### 1. Pass the current post image as a negative reference to the AI
When building the image prompt, include the post's **current `image_url`** as an input image with explicit instructions: "This is the PREVIOUS image. You MUST generate something COMPLETELY DIFFERENT — different composition, angle, color palette, subject arrangement, and mood."

This is the strongest dedup signal because the AI model can visually compare.

### 2. Include the current image URL in the dedup hint
Add the current `post.image_url` to the `dedupHint` text so it's explicitly called out as forbidden to replicate.

### 3. Pass current image to `generatePixelImage` as a negative reference
Extend `generatePixelImage` to accept an optional `previousImageUrl` parameter. When provided, add it as an `image_url` content part with a "DO NOT replicate this image" instruction.

## Changes — single file: `supabase/functions/regenerate-post/index.ts`

**`generatePixelImage` function (line 62-145):**
- Add optional `previousImageUrl` param to `options`
- When present, append an `image_url` content part + negative instruction text to `contentParts`

**Image prompt section (lines 372-390):**
- Pass `post.image_url` as `previousImageUrl` to `generatePixelImage`
- Add explicit "MUST NOT resemble the previous image" to the prompt text

