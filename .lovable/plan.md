

## Plan: Fix Aspect Ratio Enforcement for Pixel Agent Image Generation

### Problem
User selects 9:16 in the toolbar, but the generated image comes out as 1:1 (square). The aspect ratio selection is correctly passed through the chain (`AgentWorkspace` → `sendAgentMessage` → `ai-agent` → `agentToolExecutor`/`generatePixelImage`), and `cropToAspectRatio` runs after generation. However:

1. **Gemini image models ignore soft composition hints** and generate square images by default
2. **Cropping a square to 9:16 loses ~44% of content** — making the result look like a badly cropped square, not a purpose-built portrait image
3. **No explicit dimension/size instruction** is passed to Gemini models (unlike OpenAI which has a `size` parameter)

### Root Cause
The Gemini image generation request (both in `generatePixelImage` and `agentToolExecutor`) sends only `modalities: ["image", "text"]` with no dimension/size configuration. The only guidance is a text hint like "Compose the scene as a PORTRAIT layout" which models often ignore.

### Fix (3 files)

**1. `supabase/functions/_shared/agentToolExecutor.ts`**
- Strengthen the aspect ratio prompt injection (line ~614-619) with explicit pixel dimensions and more forceful language:
  - `"9:16"` → `"CRITICAL: Generate this image in PORTRAIT orientation (taller than wide). Target dimensions: 864×1536 pixels. The image MUST be significantly taller than it is wide."`
  - `"16:9"` → similar for landscape
- Add `image_generation_config` with `{ aspectRatio }` to the Gemini API request body (lines ~787-791) — Gemini 2.0+ image models support this parameter to control output dimensions

**2. `supabase/functions/ai-agent/index.ts`**
- Same changes in `generatePixelImage` function (lines ~247-255, ~369-374):
  - Stronger prompt hints with explicit dimensions
  - Add `image_generation_config` to Gemini requests

**3. `supabase/functions/_shared/imageResize.ts`**
- No changes needed — the crop logic is correct as a safety net

### Technical Detail
The Gemini image generation API via chat completions supports an `image_generation_config` field:
```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "messages": [...],
  "modalities": ["image", "text"],
  "image_generation_config": {
    "aspectRatio": "9:16"
  }
}
```
This tells the model to generate an image with the correct aspect ratio from the start, rather than relying on post-generation cropping. Combined with stronger prompt instructions, this should produce properly oriented images.

### Summary
| File | Change |
|------|--------|
| `supabase/functions/_shared/agentToolExecutor.ts` | Add `image_generation_config` to Gemini requests + stronger prompt dimension hints |
| `supabase/functions/ai-agent/index.ts` | Same changes in `generatePixelImage` function |

