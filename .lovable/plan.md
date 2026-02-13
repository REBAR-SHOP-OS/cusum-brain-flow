

# Fix: Regenerate Image Not Working

## Problem
The "Regenerate" function uses DALL-E (OpenAI) for image generation, while the working slot generation uses the Lovable AI Gateway with `google/gemini-2.5-flash-image`. The DALL-E path fails silently, resulting in text-only output with no image.

## Solution
Replace the DALL-E image generation in the regenerate block with the same Lovable AI Gateway + Gemini approach used by the main slot generation.

## Changes

### `supabase/functions/ai-agent/index.ts` (lines ~3698-3736)
Replace the DALL-E image generation block with:

```text
Before (DALL-E - broken):
  fetch("https://api.openai.com/v1/images/generations", ...)
  imgData.data?.[0]?.b64_json

After (Lovable AI Gateway - working):
  fetch("https://ai.gateway.lovable.dev/v1/chat/completions", ...)
  model: "google/gemini-2.5-flash-image"
  modalities: ["image", "text"]
  imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url
```

The base64 extraction and storage upload logic will also be updated to match the working pattern (stripping the `data:image/...;base64,` prefix before decoding).

### Deploy
Redeploy the `ai-agent` edge function after changes.
