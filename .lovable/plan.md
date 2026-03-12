

# Fix AI Image Generator - Billing Limit on OpenAI

## Problem
The "AI Image" button fails because the OpenAI API key (`GPT_API_KEY`) has reached its billing hard limit. Every request to GPT Image 1 or DALL-E 3 returns a 400 error: `"Billing hard limit has been reached."`

## Solution
Switch the default models to use **Lovable AI Gemini image models** which are already supported in the `generate-image` edge function and don't require the OpenAI API key.

## Changes

### File: `src/components/social/ImageGeneratorDialog.tsx`

1. **Replace model options** — swap OpenAI models for Gemini image models:
   - `google/gemini-3-pro-image-preview` → "Gemini Pro Image" (highest quality)
   - `google/gemini-3.1-flash-image-preview` → "Gemini Flash Image" (fast, pro-level quality)

2. **Update default selected model** to `google/gemini-3-pro-image-preview`

3. **Remove size selector** for Gemini models (Gemini image generation doesn't support explicit size parameters — it generates based on the prompt)

4. **Update button label** to reflect the selected model name

### File: `supabase/functions/generate-image/index.ts`

No changes needed — the Gemini path already works via the `selectedModel.startsWith("google/gemini")` branch using `LOVABLE_API_KEY`.

