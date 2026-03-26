

# Add Auto-Generate Prompt Button to Ad Director Chat Bar

## What
Add a sparkle/wand icon button between the Products selector and the Send button. It calls the `ai-generic` edge function to auto-generate a video prompt based on the selected duration, style(s), and product(s). The button is disabled until at least one style AND one product are selected.

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

1. **Import** `Sparkles` and `Loader2` from lucide-react
2. **Add state**: `isGenerating` boolean
3. **Add** `canAutoGenerate` computed: `selectedStyles.length > 0 && selectedProducts.length > 0`
4. **Add** `handleAutoGenerate` async function:
   - Calls `supabase.functions.invoke("ai-generic", { body: { prompt, systemPrompt } })` where the prompt includes selected products, styles, duration, and ratio
   - System prompt instructs: "You are a video ad prompt writer for a construction/rebar company. Write a single concise, cinematic video prompt (2-3 sentences) for the given parameters. Return ONLY the prompt text."
   - On success, sets the textarea value via `setPrompt(result)`
   - Shows toast on error
5. **Render** the button between Products popover and Send button:
   - `Sparkles` icon (or `Loader2` spinning when generating)
   - Disabled when `!canAutoGenerate || isGenerating || disabled`
   - Tooltip: "Auto-generate prompt"
   - Styled as a rounded-full pill matching other toolbar buttons

| File | Change |
|---|---|
| `ChatPromptBar.tsx` | Add auto-generate prompt button with AI call, enabled only when style + product selected |

