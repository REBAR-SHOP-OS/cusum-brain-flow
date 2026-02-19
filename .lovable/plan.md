
# Replace "Auto Fix" with Smart Prompt Generator

## Problem
The current "Auto Fix" button navigates to the Empire Builder page and uses the complex Architect/ARIA agent system to fix issues. This is overkill for simple fixes. Instead, we need a lightweight flow that:
1. Gathers all task evidence (title, description, comments, screenshots)
2. Sends it to an LLM for analysis
3. Returns a clean, ready-to-copy prompt for Lovable AI

## Solution

### Step 1 -- Create edge function `generate-fix-prompt`

A new backend function that:
- Receives task details (title, description, comments, attached images)
- Sends them to an LLM (GPT-4o-mini via the existing aiRouter -- fast and cheap)
- Returns a well-structured Lovable AI prompt

The LLM system prompt will instruct it to:
- Analyze the issue from all evidence
- Identify the root cause
- Write a clear, actionable prompt formatted for Lovable AI
- Include file paths if identifiable from the evidence
- Keep it concise and surgical

### Step 2 -- Replace "Auto Fix" button in Tasks.tsx

Replace the current button that navigates to `/empire?autofix=...` with a new "Generate Fix Prompt" button that:
1. Collects the task title, description, and all comments (including reopened-with-issue reasons and any screenshot URLs)
2. Calls the `generate-fix-prompt` edge function
3. Shows the generated prompt in a dialog with a "Copy to Clipboard" button
4. User copies the prompt and pastes it into Lovable AI chat

### Step 3 -- Remove Empire Builder dependency from Tasks

The Tasks page will no longer navigate to `/empire` for fixes. The flow stays entirely within the Tasks page.

## UI Flow

```
User clicks "Generate Fix" on a task
  --> Loading spinner appears
  --> Dialog opens with the generated prompt
  --> User clicks "Copy Prompt" button
  --> Pastes into Lovable AI chat
  --> Fix applied
```

## Technical Details

### New file: `supabase/functions/generate-fix-prompt/index.ts`

- Uses `callAI` from `_shared/aiRouter.ts` with GPT-4o-mini
- System prompt instructs the LLM to act as a senior developer analyzing bug reports
- Input: `{ title, description, comments: string[], screenshots: string[] }`
- Output: `{ prompt: string }` -- a ready-to-paste Lovable AI prompt

### Modified file: `src/pages/Tasks.tsx`

- Replace the "Auto Fix" button (lines 911-922) with "Generate Fix" button
- Add state: `fixPromptOpen` (boolean), `fixPrompt` (string), `fixLoading` (boolean)
- On click: gather task data + comments, call edge function, show result in a Dialog
- Dialog contains the prompt text in a styled box with a "Copy" button
- Remove the `navigate('/empire?autofix=...')` logic entirely from this button

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-fix-prompt/index.ts` | New edge function -- LLM analyzes evidence and outputs a Lovable AI prompt |
| `src/pages/Tasks.tsx` | Replace "Auto Fix" button with "Generate Fix" that shows copyable prompt in a dialog |
