

# Pexels-Powered AI Image Generator for Advertising

## Problem
The AI Image Generator currently generates images from scratch using only the user's text prompt. The user wants it to leverage Pexels stock photos as a visual reference/inspiration, combined with the brand context, to produce the best possible advertising images for the company.

## Approach
Enhance the `generate-image` edge function to first search Pexels for relevant stock photos based on the user's prompt, then feed those reference images into Gemini's image editing capability to create a branded, advertising-optimized image.

## Changes

### 1. `supabase/functions/generate-image/index.ts`
- Before calling Gemini, search Pexels for 1-2 top photos matching the prompt keywords
- Pass the best Pexels photo URL as a reference image to Gemini using the image editing API (multi-modal input: text instruction + reference image)
- Enhance the prompt with brand context (business name, industry, value prop from brand kit) and advertising direction
- The AI instruction will say: "Using this reference image as inspiration, create a professional advertising image for [brand]. [user prompt]"
- Fallback: if Pexels returns no results, generate from text-only as before

### 2. `src/components/social/ImageGeneratorDialog.tsx`
- Add a "Pexels-powered" badge/indicator so the user knows the system uses stock inspiration
- During generation, show a two-step status: "Finding inspiration..." → "Generating your ad image..."
- Pass brand kit context (business_name, description, value_prop) in the request body so the edge function can build an advertising-focused prompt
- Update placeholder text to be advertising-oriented: "Describe the advertising image you want..."

### 3. Edge function flow (detailed)
```text
User prompt + brand context
        │
        ▼
  ┌─────────────┐
  │ Pexels API  │ ← search top 1 photo matching prompt keywords
  └──────┬──────┘
         │ reference image URL
         ▼
  ┌──────────────────┐
  │ Gemini Image API │ ← text: ad-optimized prompt + brand info
  │  (edit mode)     │   image: Pexels reference photo
  └──────┬───────────┘
         │
         ▼
   Generated ad image
```

The Gemini call uses the existing image editing pattern:
```typescript
messages: [{
  role: "user",
  content: [
    { type: "text", text: advertisingPrompt },
    { type: "image_url", image_url: { url: pexelsPhotoUrl } }
  ]
}]
```

This ensures every generated image is grounded in real, high-quality stock photography while being customized for the company's advertising needs.

