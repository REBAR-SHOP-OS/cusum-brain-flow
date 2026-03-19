

# Auto-Analyze Employee Feedback → Generate Lovable Patches in CEO Portal

## Problem Today

When employees submit screenshot feedback, it creates a task assigned to **Radin** (`FEEDBACK_RECIPIENTS`). Radin has to manually investigate, understand the bug, and fix it. The CEO wants to eliminate this delegation — instead, Vizzy should automatically analyze the feedback deeply, generate a real Lovable patch command, and add it to the CEO Portal Fixes Queue. After the patch is applied, the system confirms it worked.

## Changes

### 1. New Edge Function: `analyze-feedback-fix` 

A new backend function that receives a feedback task (title, description, screenshot URL, page path) and:
- Sends all evidence (description, screenshot as base64, page context) to Gemini 2.5 Pro with the same surgical prompt used in `generate-fix-prompt` but enhanced with feedback-specific context
- Generates a full Lovable patch command
- Saves the result to `vizzy_memory` (category: `feedback_fix`) so the Fixes Queue can pick it up
- Updates the original task status to `resolved` (no more waiting for Radin)

### 2. Auto-Trigger on Feedback Submission

Modify `AnnotationOverlay.tsx` and `InboxPanel.tsx` (the two places where `screenshot_feedback` tasks are created):
- After creating the task, fire-and-forget call `analyze-feedback-fix` with the feedback data
- Remove Radin from `FEEDBACK_RECIPIENTS` for auto-analyzed items — the system handles it now
- Keep task creation for audit trail but mark as `system_processing` instead of assigning to Radin

### 3. Auto-Trigger on Reopened Feedback

Modify `Tasks.tsx` `reopenWithIssue` function:
- When a feedback task is reopened with an issue, instead of creating a new task for Radin, call `analyze-feedback-fix` with the original issue + the reopening reason
- This eliminates the "🔄 مشکل حل نشده" delegation loop

### 4. Expand FixesQueue to Show Feedback Fixes

Update `FixesQueue.tsx`:
- Query both `agent_audit` AND `feedback_fix` categories from `vizzy_memory`
- Add a "Feedback" badge type alongside "Agent" badges
- Parse the same `LOVABLE COMMAND:` format from feedback fixes

### 5. Post-Fix Verification Status

Add a "Mark as Applied" button to each fix in the Fixes Queue:
- When CEO clicks it after pasting the fix, update the `vizzy_memory` record metadata with `{ applied: true, applied_at: timestamp }`
- Change the card appearance to show a green checkmark
- Filter applied fixes to a collapsible "Applied" section at the bottom

## Technical Details

**New file:**
- `supabase/functions/analyze-feedback-fix/index.ts` — deep feedback analyzer + patch generator

**Files to modify:**
- `src/components/feedback/AnnotationOverlay.tsx` — add fire-and-forget call to `analyze-feedback-fix` after task creation
- `src/components/panels/InboxPanel.tsx` — same fire-and-forget call on feedback reopening
- `src/pages/Tasks.tsx` — replace Radin delegation in `reopenWithIssue` with `analyze-feedback-fix` call
- `src/components/ceo/FixesQueue.tsx` — add `feedback_fix` category, "Mark Applied" button, applied section
- `supabase/config.toml` — add `analyze-feedback-fix` function config

**Edge function input:**
```typescript
{
  title: string;
  description: string;
  screenshot_url?: string;
  page_path?: string;
  reopen_reason?: string; // if reopened
  original_task_id?: string;
}
```

**Edge function flow:**
1. Fetch screenshot → base64
2. Call AI with enhanced feedback analysis prompt
3. Save to `vizzy_memory` with category `feedback_fix`
4. Resolve original task

