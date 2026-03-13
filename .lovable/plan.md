

# Fix Reference Image Handling in Image Edit

## Problem
When users upload a reference image and ask to place it in a specific area, the current prompt tells the AI to use it as "visual reference/inspiration." The user wants the AI to actually **use the uploaded image directly** — e.g., place that exact logo/image into the marked area.

## Change

### `supabase/functions/generate-image/index.ts` (line 176-178)

Update the edit prompt when a reference image is present:

**Current:**
> "Use the second image as a visual reference/inspiration for the edit."

**New:**
> "The second image is a reference asset provided by the user. You MUST incorporate/place this exact image into the red-marked area as instructed. Reproduce the reference image as faithfully as possible in the designated area."

This single prompt change ensures Gemini treats the reference image as content to be placed/used directly, not just inspiration.

### File changed
- `supabase/functions/generate-image/index.ts` (1 line change in the prompt string)

