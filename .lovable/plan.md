

# Add Gemini & ChatGPT Image Generator Icons to Pixel Toolbar

## What Changes
Replace the single image generator icon in the Pixel agent toolbar with **two separate icons** — one for **Gemini** and one for **ChatGPT** — so the user can choose which LLM generates their image.

## Visual Result
The toolbar will show two new icons side by side (only in the Pixel agent):
- **Gemini icon** — opens the image generator dialog pre-set to Gemini
- **ChatGPT icon** — opens the image generator dialog pre-set to ChatGPT/DALL-E

## Files to Modify (Pixel-only, no other parts of the app)

### 1. `src/pages/AgentWorkspace.tsx`
- Replace the single `ImageIcon` button (lines 289-297) with **two buttons**:
  - A Gemini button (using a `Sparkles` or custom SVG icon) that opens ImageGeneratorDialog with `provider="gemini"`
  - A ChatGPT button (keeping the existing `ImageIcon` or using a distinct icon) that opens with `provider="chatgpt"`
- Add a new state `imageGenProvider` to track which provider was selected
- Pass the provider to `ImageGeneratorDialog`

### 2. `src/components/social/ImageGeneratorDialog.tsx`
- Accept new prop `provider?: "gemini" | "chatgpt"`
- When `provider="gemini"`: show only Gemini models (using Lovable AI gateway with `google/gemini-2.5-flash-image` and `google/gemini-3-pro-image-preview`)
- When `provider="chatgpt"`: show existing models (GPT Image 1, DALL-E 3) — no changes to current behavior
- Update `handleGenerate` to route Gemini requests to a new edge function

### 3. `supabase/functions/generate-image-gemini/index.ts` (NEW file)
- New edge function that calls Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `google/gemini-2.5-flash-image` or `google/gemini-3-pro-image-preview`
- Uses `LOVABLE_API_KEY` (already auto-provisioned, no user input needed)
- Returns the generated image as a base64 data URI
- Includes auth verification and CORS headers matching the existing pattern

### 4. `supabase/config.toml`
- Will be auto-updated when the new edge function is deployed (no manual edit needed)

## Technical Details

**Gemini image generation flow:**
```text
User clicks Gemini icon
  -> ImageGeneratorDialog opens (provider=gemini)
  -> User enters prompt, clicks Generate
  -> Calls generate-image-gemini edge function
  -> Edge function calls Lovable AI gateway with google/gemini-2.5-flash-image
  -> Returns base64 image -> displayed in dialog
```

**ChatGPT flow remains unchanged** — uses existing `generate-image` edge function with OpenAI API.

**Icon design:** Two small, recognizable icons side by side. Gemini will use a diamond/sparkle-style icon, ChatGPT will use the existing image icon or a chat-bubble style icon. Both will have tooltips ("Generate with Gemini" / "Generate with ChatGPT").

## Scope Guarantee
- Only Pixel agent toolbar and its ImageGeneratorDialog are modified
- No other agents, pages, or app functionality are touched
- The existing ChatGPT generation path is completely preserved

