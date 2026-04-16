

## Plan: Add AI Prompt Writer Button to ChatPromptBar

### What
Add a `Wand2` (magic wand) icon button in the toolbar row (next to Style, Products, etc.) that generates a cinematic video prompt based on the user's selected style, duration, and products.

### Changes

**File: `src/components/ad-director/ChatPromptBar.tsx`**

1. Import `Wand2` and `Loader2` from lucide-react
2. Add `aiWriting` state (`useState(false)`)
3. Add `handleAiWrite` function that:
   - Collects selected styles, products, and duration
   - Calls `invokeEdgeFunction("ad-director-ai", { action: "write-script", input: contextString })` where `contextString` summarizes the selections (e.g. "Style: Construction, Realism. Products: Stirrups, Cages. Duration: 30s.")
   - Sets the returned text into `setPrompt(result.text)`
4. Add a `Wand2` icon button in the toolbar row (line ~545, before "Create video"), styled as a rounded-full pill matching the other toolbar buttons, with tooltip "AI writes the prompt"
5. Button shows `Loader2` spinner while generating, disabled when `aiWriting` or `disabled`

### What stays the same
- All existing controls (ratio, duration, style, products, model)
- Submit / Create video button
- Reference upload cards
- Edge function `ad-director-ai` with `write-script` action — already exists

