

## Plan: Fix SEO Task Executor to Use GSC Sync Instead of Asking for Manual Steps

### Problem
When a SEO task related to Google Search Console data (keyword performance, impressions, clicks, CTR) is created, clicking "Execute" shows "Manual Steps Required" telling the user to manually export data from GSC. This is wrong because:

1. GSC **is** connected via Google OAuth
2. The system **already has** a `seo-gsc-sync` edge function that pulls GSC data automatically
3. The AI task planner in `seo-task-execute` doesn't know about this capability — its prompt only lists WordPress API actions

### Root Cause
In `supabase/functions/seo-task-execute/index.ts`, the system prompt (line 87-117) tells the AI planner that "Google Search Console verification" is something it CANNOT auto-execute. The planner has no knowledge of the `seo-gsc-sync` function that can pull GSC data.

### Fix

**File: `supabase/functions/seo-task-execute/index.ts`**

1. **Add GSC sync to the "CAN auto-execute" list** in the system prompt — add a new action type `trigger_gsc_sync` that calls the `seo-gsc-sync` edge function
2. **Add the action handler** in the execution logic to invoke `seo-gsc-sync` when the AI planner returns a `trigger_gsc_sync` action
3. **Remove "Google Search Console verification" from the CANNOT list** (or clarify it only means initial domain verification, not data syncing)

### Technical Details

- Add to system prompt CAN-execute list: `- Pulling keyword performance data from Google Search Console → trigger_gsc_sync`
- Add action type `trigger_gsc_sync` to the tool schema
- In the execution switch/handler, call `supabase.functions.invoke("seo-gsc-sync", { body: { domain_id } })` when this action is triggered
- Mark the task as done after successful sync

### Result
GSC data tasks will auto-execute by triggering the existing sync function instead of showing manual steps.

