
# Fix Follow-Up & Draft Email Prompts + Add Follow-Up Action to Prospecting

## Problem
The `draft_followup` and `draft_email` actions in `pipeline-ai` still lack the anti-placeholder rules applied to `draft_intro`. Also, the prospecting table has no way to send a follow-up after the initial intro has been sent (status = "emailed").

## Changes

### 1. `supabase/functions/pipeline-ai/index.ts` -- Fix `draft_followup` prompt (line 188)

Add the same critical rules:
- No placeholder brackets
- First-name greeting
- Sign off as "The rebar.shop Sales Team"
- 3-5 sentences, warm but direct

### 2. `supabase/functions/pipeline-ai/index.ts` -- Fix `draft_email` prompt (line 219)

Same anti-placeholder rules applied to the general `draft_email` action.

### 3. `src/components/prospecting/ProspectTable.tsx` -- Add "Send Follow-up" button for emailed prospects

Add a new button (mail icon) visible when `status === "emailed"` so users can send a follow-up after the initial intro. This calls a new `onSendFollowup` callback.

### 4. `src/components/prospecting/ProspectIntroDialog.tsx` -- Support follow-up mode

Add a `mode` prop (`"intro" | "followup"`). When in follow-up mode:
- Dialog title changes to "Send Follow-up"
- Uses `draft_followup` action instead of `draft_intro`
- Passes prospect context so the AI references the prior introduction

### 5. `src/pages/Prospecting.tsx` -- Wire up follow-up flow

- Add state for follow-up mode
- Pass `onSendFollowup` handler to `ProspectTable`
- Open `ProspectIntroDialog` in follow-up mode when triggered

## Result
- All email actions produce clean, placeholder-free emails signed by "The rebar.shop Sales Team"
- Emailed prospects show a follow-up button so reps can keep the conversation going
