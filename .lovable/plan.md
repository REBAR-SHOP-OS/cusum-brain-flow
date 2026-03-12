

# Align Image Generator Dialog with Pixel Agent's Logic

## Problem
The AI Image Generator dialog uses a generic advertising prompt, while the Pixel Agent (in `agentToolExecutor.ts` and `auto-generate-post`) has a detailed photorealistic, product-focused prompt system with mandatory logo inclusion and diverse visual styles. The user wants the dialog to match this quality.

## Changes

### 1. `supabase/functions/generate-image/index.ts` — Rewrite `buildAdPrompt`
Replace the current generic prompt with the Pixel Agent's photorealistic rules:

- **Photorealistic mandate**: "ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY. ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract."
- **Product showcase**: Include REBAR.SHOP products (rebar stirrups, ties, accessories) in the scene based on the user's prompt
- **Visual style rotation**: Reference the 12 diverse styles (construction sites, drone views, macro shots, warehouse settings, etc.)
- **Logo via reference image**: When the brand kit has a `logo_url`, fetch it and pass it as a second reference image to Gemini alongside the Pexels reference, with the instruction: "Incorporate the provided company logo as a branded watermark exactly as shown — no changes to color, shape, or design."
- **Keep the Pexels reference flow** but enhance the combined prompt

### 2. `supabase/functions/generate-image/index.ts` — Add logo as multi-modal input
Currently the logo is applied client-side via Canvas. The Pixel Agent also passes the logo directly to Gemini as a reference image. We'll do **both**:
- Pass `logo_url` (from request body or brand context) to Gemini as an additional image input so the AI can integrate it naturally into the composition
- Keep the client-side Canvas overlay as a fallback guarantee

Update the edge function to accept `logoUrl` in the request body and include it in the multi-modal content array:
```text
content: [
  { type: "text", text: pixelAgentStylePrompt },
  { type: "image_url", image_url: { url: pexelsRef } },    // Pexels inspiration
  { type: "image_url", image_url: { url: logoUrl } },      // Brand logo
  { type: "text", text: "Incorporate this logo as a branded watermark." }
]
```

### 3. `src/components/social/ImageGeneratorDialog.tsx` — Pass logo URL
- Add `brandKit?.logo_url` to the request body sent to the edge function
- Keep the existing client-side Canvas logo overlay as a guaranteed fallback

### 4. Prompt template (inside `buildAdPrompt`)
```text
PHOTOREALISTIC ADVERTISING IMAGE — {business_name}

RULES:
- Real-world professional photography ONLY. Natural lighting, real textures.
- FORBIDDEN: CGI, 3D renders, illustrations, cartoons, fantasy, abstract.
- Feature {business_name} products prominently in the scene.
- Clean, professional, visually striking — like commercial photography.
- {user_prompt}

Brand: {business_name} | {value_prop}
Tagline: {tagline}

Visual style: Choose from construction sites, warehouse product shots,
macro detail shots, drone aerial views, urban infrastructure, etc.

Do NOT render any text or logo — the logo overlay is handled separately.
```

This aligns the dialog's generation quality with the Pixel Agent's standards while keeping the Pexels inspiration and client-side logo overlay intact.

