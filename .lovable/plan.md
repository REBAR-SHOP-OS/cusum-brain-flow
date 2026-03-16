

# Fix: Image Aspect Ratio Not Applied in Pixel Agent

## Root Cause
The aspect ratio instruction is appended at the **end** of very long prompts (after logo instructions, style directions, etc.), where Gemini models tend to ignore it. Additionally, the Gemini image generation path has no programmatic size control — it relies solely on text instructions, unlike the OpenAI path which passes explicit `size` parameters.

## Solution
Move the aspect ratio instruction to the **very beginning** of the prompt (highest priority position) and make it more explicit with pixel dimensions. Apply this fix in both files that contain `generatePixelImage`:

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Move aspect ratio to start of prompt with pixel dimensions |
| `supabase/functions/regenerate-post/index.ts` | Same fix |

### Specific Changes

In both `generatePixelImage` functions:

1. **Move `aspectInstruction` to the START** of `finalPrompt` instead of the end:
   ```
   // Before: finalPrompt = fullPrompt + aspectInstruction  (end)
   // After:  finalPrompt = aspectInstruction + "\n\n" + fullPrompt  (start)
   ```

2. **Add explicit pixel dimensions** to the text instruction so Gemini has a concrete target:
   ```
   "MANDATORY IMAGE DIMENSIONS: Generate in LANDSCAPE format (1536×1024 pixels, 16:9 ratio). The output MUST be wider than tall."
   ```

3. **Add `aspect_ratio` to the Gemini API request body** as an extra signal (some Gemini image models support this):
   ```ts
   body: JSON.stringify({
     model: attempt.model,
     messages: [...],
     modalities: ["image", "text"],
     aspect_ratio: aspectRatio,  // "16:9", "9:16", or "1:1"
   })
   ```

This three-layer approach (prompt priority + pixel dimensions + API parameter) ensures reliable aspect ratio enforcement across all generation paths.

