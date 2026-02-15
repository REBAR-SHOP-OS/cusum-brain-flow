

# AI Task Execution System for SEO Module

## Overview

Add an "Execute" button to each SEO task card. When clicked, an AI agent analyzes the task to determine if it can be auto-executed (e.g., updating WordPress meta titles, descriptions, content). If yes, it shows a confirmation dialog with the proposed plan. If no, it shows manual instructions for the human operator. On confirmation, it executes via the existing WordPress API tools and marks the task as "Done".

## User Flow

```text
User clicks [Execute] on a task card
        |
        v
  AI analyzes the task (loading spinner)
        |
        +---> CAN auto-execute
        |       Show dialog: plan summary + action list
        |       [Confirm] --> Execute actions --> Toast success --> Task moves to Done
        |       [Cancel] --> Close dialog
        |
        +---> CANNOT auto-execute
                Show dialog: step-by-step human instructions
                [Move to In Progress] --> Updates status
                [Close] --> Do nothing
```

## Changes

### 1. Database Migration

Add execution tracking columns to `seo_tasks`:

| Column | Type | Purpose |
|--------|------|---------|
| `execution_log` | jsonb | Full audit trail of what AI did |
| `executed_at` | timestamptz | When execution completed |
| `executed_by` | text | 'ai' or user ID |

### 2. New Edge Function: `seo-task-execute`

Two-phase function using the Lovable AI gateway for task analysis and the existing `WPClient` for WordPress actions.

**Phase "analyze":**
- Fetches the task from the database
- Validates status is "open" or "in_progress"
- Sends task details to AI with a structured tool-calling schema
- AI determines if the task is automatable and returns either:
  - `{ can_execute: true, plan_summary, actions: [...] }` with predefined action types
  - `{ can_execute: false, human_steps: "..." }` with manual instructions

**Phase "execute":**
- Re-fetches and re-validates the task (never trusts client-side plan)
- Re-runs analysis to get fresh actions
- Executes each action via `WPClient` (update meta, update content, add internal links)
- Updates the task: status to "done", sets `execution_log`, `executed_at`, `executed_by`
- Returns results

**Allowed action types (safety whitelist):**
- `wp_update_meta` -- Update page/post meta description or title tag
- `wp_update_content` -- Update page/post content HTML
- `wp_update_title` -- Update page/post title
- `wp_add_internal_link` -- Add internal link to page content

**Blocked:** DNS changes, billing, GSC verification, user management, product deletion.

### 3. Frontend Update: `SeoTasks.tsx`

- Add "Execute" button (Zap icon) on task cards with status "open" or "in_progress"
- Add AlertDialog for the two-step confirmation flow
- Loading state while AI analyzes
- On confirm: call execute phase, show toast, refresh task list
- On "can't execute": show human instructions with option to move to "In Progress"

## Technical Details

### Database Migration SQL

```sql
ALTER TABLE public.seo_tasks
  ADD COLUMN IF NOT EXISTS execution_log jsonb,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_by text;
```

### Edge Function: `seo-task-execute/index.ts`

- Uses `createClient` from supabase-js for DB access
- Uses `WPClient` from `../_shared/wpClient.ts` for WordPress operations
- Uses Lovable AI gateway (`LOVABLE_API_KEY`) with tool calling for structured output
- Action types are whitelisted -- unknown types are rejected
- Full execution log stored as JSONB for audit

### Config Addition

```toml
[functions.seo-task-execute]
verify_jwt = false
```

### Frontend Component Changes

- Import `AlertDialog` components, `Zap`, `Loader2`, `CheckCircle`, `AlertTriangle` icons
- Add state: `executingTaskId`, `analyzeResult`, `isAnalyzing`, `isExecuting`, `showDialog`
- Execute button appears only on "open" and "in_progress" cards
- Dialog content switches between "can execute" (with confirm) and "cannot execute" (with human steps)

### Files Modified/Created

| File | Change |
|------|--------|
| Database migration | Add 3 columns to `seo_tasks` |
| `supabase/functions/seo-task-execute/index.ts` | New edge function |
| `src/components/seo/SeoTasks.tsx` | Add Execute button + dialog |

