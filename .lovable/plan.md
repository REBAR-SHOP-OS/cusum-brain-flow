

## Plan: Replace Flash Model Option with ChatGPT Icon Button

### Problem
The "Gemini Flash Image" radio option takes up space and the user wants it replaced with a simple ChatGPT icon button that uses OpenAI's `gpt-image-1` model.

### Changes

**File: `src/components/social/ImageGeneratorDialog.tsx`**

1. **Remove `modelOptions` array** (lines 42-53) — no longer needed as a list.

2. **Replace the Model selector UI** (lines 236-264) with a single row showing:
   - "Gemini Pro Image" as the default (always selected)
   - A small ChatGPT icon button on the right that toggles `selectedModel` to `"gpt-image-1"`
   - Layout: `flex items-center justify-between` with the label on the left and a toggle icon on the right

3. **Update `selectedModel` state** default stays `"google/gemini-3-pro-image-preview"`. Clicking the ChatGPT icon toggles to `"gpt-image-1"`, clicking again toggles back.

4. **ChatGPT icon**: Use a small circular button with the OpenAI logo (SVG inline or a simple `Bot` icon from lucide with "GPT" label). When active, it gets a green/primary ring highlight.

5. **No backend changes needed** — the `generate-image` edge function already handles `gpt-image-1` as a model value and falls through to the OpenAI path.

### Technical Details
- Single file change: `src/components/social/ImageGeneratorDialog.tsx`
- The edge function at lines 401-440 already handles OpenAI models when the selected model is `gpt-image-1`
- The ChatGPT toggle will be a compact icon button (~32px) with tooltip "Generate with ChatGPT"

