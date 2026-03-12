

## Add LLM Model Selector & Cost Preview to Video Studio Prompt Bar

### What Changes

Add a new **Model** pill selector in the bottom toolbar of the prompt bar, showing available AI models per media type. Before the user clicks Generate, display the estimated cost prominently.

### Models by Media Type

**Video**: Google Veo 3.1, OpenAI Sora, Sora Pro (already mapped via mode — expose as explicit model pill)

**Image**: 
- GPT Image 1 (current)
- Lovable AI: Nano Banana (gemini-2.5-flash-image) — free via gateway
- Lovable AI: Nano Banana Pro (gemini-3-pro-image-preview) — free via gateway  
- Lovable AI: Nano Banana 2 (gemini-3.1-flash-image-preview) — free via gateway

**Audio**: ElevenLabs (current, single option)

### Cost Display

Replace the small "Cost: Xs" text with a visible cost badge next to the Generate button:
- Video: `"Cost: {creditCost}s of {remaining}s"` 
- Image (GPT): `"~$0.02/image"`
- Image (Lovable AI): `"Free (included)"`
- Audio: `"Free (included)"`

### Files to Modify

**1. `src/components/social/VideoStudioPromptBar.tsx`**
- Add `model` and `onModelChange` props
- Add model options config per media type
- Add Model pill selector (Popover, same style as Mode/Aspect pills)
- Update cost display area: show model-specific cost info next to Generate button
- For image Lovable AI models, show "Free" badge

**2. `src/components/social/VideoStudioContent.tsx`**
- Add `selectedModel` state, default per media type
- Pass model to prompt bar
- Route image generation: if Lovable AI model selected, call `generate-image` edge function with Lovable gateway; if GPT, use existing flow
- Create `handleGenerateImageLovable()` that calls edge function with Lovable AI gateway model

**3. `supabase/functions/generate-image/index.ts`**
- Add branch: if `model` starts with `google/gemini`, use Lovable AI gateway (`LOVABLE_API_KEY`) with `modalities: ["image", "text"]` format instead of OpenAI
- Parse base64 image from response, upload to storage, return URL

### UI Layout (bottom pill row)

```text
[Mode ▾] [Model ▾] [16:9 ▾] [⏱ 8s ▾] [Ref image]  ——spacer——  [Free ✓ | Cost: 8s]
```

