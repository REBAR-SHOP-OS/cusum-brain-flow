

# Fix Image Edit: Improve Prompt & Remove Red Marks from Result

## Problem
Two issues with the "Edit Image with AI" feature:
1. The AI sometimes doesn't properly apply the requested changes to the red-marked areas
2. Red marks from the user's annotations sometimes persist in the generated result

## Root Cause
The current prompt sends the composite image (original + red marks drawn on top) and asks the AI to edit "only the red areas." The AI must both understand the red marks as instructions AND remove them — which is unreliable. The prompt needs to be more explicit about removing the red overlay completely.

## Solution

### 1. Improve the edit prompt in `supabase/functions/generate-image/index.ts`
Update the inpainting prompt (lines 176-178) to explicitly instruct the AI to:
- Treat the red-highlighted areas as the ONLY regions to modify
- **Completely remove all red marks/highlights** from the output — they are annotations, not part of the image
- Apply the user's instruction to those regions
- Output a clean image with zero red overlay remaining

### 2. Send a clean original image alongside the annotated one
In `src/components/social/ImageEditDialog.tsx`, generate **two** images:
- The **annotated** canvas (with red marks) — so the AI knows WHERE to edit
- The **clean original** image (without marks) — so the AI has a pristine reference

Update `handleApply` to also send `originalImage` (the base image without red strokes) alongside `editImage` (the annotated version). The edge function will pass both to the AI with instructions to use the clean image as base and the annotated image only for location reference.

### Changes

**`src/components/social/ImageEditDialog.tsx`** — In `handleApply`:
- Create a separate canvas, draw only the original image (no strokes), export as `originalBase64`
- Send both `editImage` (annotated) and `originalImage` (clean) to the edge function

**`supabase/functions/generate-image/index.ts`** — In the edit mode block (lines 174-230):
- Accept `originalImage` parameter
- Update prompt: "The first image shows red annotations marking the areas to edit. The second image is the clean original. Apply the edit instruction to the marked areas using the clean image as the base. The output must have NO red marks whatsoever."
- Pass both images to the AI model

