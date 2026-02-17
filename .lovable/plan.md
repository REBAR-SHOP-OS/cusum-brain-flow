

# Fix: Screenshot Feedback "created_by" Column Error

## Problem

The error at the bottom of the screenshot says: **"Failed to send feedback: Could not find the 'created_by' column of 'tasks' in the schema cache"**

The `AnnotationOverlay.tsx` insert includes `created_by: userId` but the `tasks` table has no such column.

## Fix (Single line removal)

### `src/components/feedback/AnnotationOverlay.tsx` (line 162)

Remove the `created_by: userId ?? undefined,` line from the task insert object. The `tasks` table columns are: `id, title, description, status, priority, due_date, assigned_to, customer_id, source, source_ref, agent_type, created_at, updated_at, completed_at, company_id, attachment_url` -- no `created_by`.

No other files, no database changes, no new dependencies.

