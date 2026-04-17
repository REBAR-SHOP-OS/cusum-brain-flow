

## Plan: AI Prompt Dialog with User Requirements

### Problem
Currently "AI Prompt" button auto-generates a prompt silently using only chip selections (style/products/duration). The user wants: clicking the button opens a dialog where they describe what they want, and the AI writes the cinematic prompt based on **their requirements**.

### Solution
Add a dialog that opens when "AI Prompt" is clicked. User types their idea/requirements (e.g. "30s contractor ad in Toronto, focus on rebar cages, energetic mood"). Existing chip selections (style, products, duration, ratio) are sent as additional context. The generated prompt fills the main textarea for review/edit before "Create video".

### Changes

**1. New file: `src/components/ad-director/AIPromptDialog.tsx`**
- Dialog (RTL-aware textarea, supports Persian/English) with:
  - Title: "Write prompt with AI" + sparkle icon
  - Description: "Tell us what you want — we'll engineer the cinematic prompt"
  - Textarea (min 6 rows): "Describe your ad idea, target audience, mood, key message…"
  - Small chip row showing what context will be added (style, products, duration, ratio) — read-only preview so user knows it's auto-included
  - Footer: Cancel + "Generate Prompt" button (disabled until text entered, shows spinner while loading)
- Props: `open`, `onClose`, `onGenerate(userInput)`, `generating`, `contextChips: string[]`

**2. `src/components/ad-director/ChatPromptBar.tsx`**
- Add `aiDialogOpen` state
- Change `handleAiWrite` → opens dialog instead of immediately calling AI
- Add `handleAiGenerate(userInput)` that calls the edge function with user input + chip context combined:
  - `input: "${userRequirements}\n\nContext: Style: …, Products: …, Duration: 30s, Ratio: 16:9"`
- Wire button `onClick={() => setAiDialogOpen(true)}` (remove `disabled={aiWriting}` since dialog handles its own loading)
- Render `<AIPromptDialog>` at the bottom

### What stays the same
- `ad-director-ai` edge function (`write-script` action) — already accepts free-form input, no backend changes
- All chip selections, upload cards, ratio/duration controls — unchanged
- Generated prompt still lands in the main textarea for editing before "Create video"

### Result
Click "AI Prompt" → dialog opens → user types their requirements → click "Generate Prompt" → AI writes cinematic prompt using user input + chip context → prompt fills main textarea → user edits if needed → "Create video".

