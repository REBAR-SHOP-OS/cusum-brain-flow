
# Add Grammar/Spell Check to All Textboxes

## Overview

Add a "Grammarly-like" check-and-fix button to all textboxes across the app. When a user types text in any textarea, they can click a button to have AI fix grammar, spelling, punctuation, and clarity before the text is sent.

## Architecture

### 1. New Edge Function: `grammar-check`

A lightweight edge function at `supabase/functions/grammar-check/index.ts` that:
- Accepts `{ text: string }` in the body
- Uses `callAI` from the shared router (GPT-4o-mini, fast and cheap)
- System prompt: "Fix grammar, spelling, punctuation, and clarity. Do NOT change meaning, tone, or intent. If the text is already correct, return it unchanged. Return ONLY the corrected text."
- Returns `{ corrected: string, changed: boolean }` (so the UI knows whether anything was actually fixed)

### 2. New Reusable Component: `SmartTextarea`

A drop-in replacement wrapper at `src/components/ui/SmartTextarea.tsx` that:
- Renders the existing `Textarea` component with all its props
- Adds a small floating toolbar below/beside the textarea with a "Check Grammar" button (spell-check icon)
- On click: sends current text to `grammar-check`, replaces the text, and shows a toast ("Text corrected" or "Looks good, no changes needed")
- Shows a loading spinner while checking
- Only shows the button when the textarea has content (3+ characters)
- Preserves all existing Textarea props (className, placeholder, rows, onChange, etc.)

### 3. Replace `Textarea` with `SmartTextarea` in All Relevant Files

Swap `Textarea` for `SmartTextarea` in files where text is composed/sent — specifically:

| File | Field(s) |
|---|---|
| `src/components/email/ComposeEmail.tsx` | Message body |
| `src/components/inbox/EmailReplyComposer.tsx` | Reply text |
| `src/components/inbox/ComposeEmailDialog.tsx` | Email body |
| `src/components/inbox/EmailTemplatesDrawer.tsx` | Template body |
| `src/components/teamhub/MessageThread.tsx` | Chat message |
| `src/components/pipeline/LeadTimeline.tsx` | Notes |
| `src/components/accounting/TableRowActions.tsx` | Email body |
| `src/components/email-marketing/CreateCampaignDialog.tsx` | AI brief |
| `src/components/inbox/InboxManagerSettings.tsx` | Custom instructions |
| `src/pages/AdminPanel.tsx` | Duties textarea |
| `src/components/social/ImageGeneratorDialog.tsx` | Image prompt |
| `src/pages/Tasks.tsx` | Task description, comments |

Each file change is a simple import swap (`Textarea` to `SmartTextarea`) with zero logic changes.

---

## Technical Details

### Edge Function (`grammar-check`)

```
POST /grammar-check
Body: { text: "some text with erors" }
Response: { corrected: "some text with errors", changed: true }
```

Uses GPT-4o-mini via `callAI` from `_shared/aiRouter.ts` for speed and low cost. Max 500 tokens, temperature 0.2 (deterministic corrections).

### SmartTextarea Component

- Wraps the existing `Textarea` — fully backward-compatible (same props interface)
- Adds a small "ABC check" button that appears when text length > 2
- The button sits in a small toolbar row below the textarea
- Calls `grammar-check` edge function on click
- Updates the value via the existing `onChange` handler (synthetic event)
- Shows toast feedback: "Corrected" or "No issues found"

### What Is NOT Changed

- The base `src/components/ui/textarea.tsx` component — untouched
- Database schema — untouched
- Any page layout, routing, or business logic — untouched
- The existing `AISuggestButton` and `ai-inline-suggest` function — untouched
- The `draft-email` polish feature — untouched (different purpose)
