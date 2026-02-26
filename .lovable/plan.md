

## Plan: Auto-create Employee Tasks from Overdue Pipeline Leads for Ben

### Problem
Leads with overdue activity (red bar segments) in the "Estimation - Ben", "QC - Ben", and "Addendums" columns are not being tracked as tasks for Ben (`ben@rebar.shop`, profile ID `9425cc2b-9f02-4d44-bb1a-8e24928f44bd7`).

### Current State
- Pipeline columns show activity status bars: green (planned), orange (today), red (overdue)
- "Overdue" = `expected_close_date` is before today
- Currently 2 overdue leads: 1 in `qc_ben` (N.SANI COMPANY LIMITED) and 1 in `addendums` (Gen-Pro)
- The `tasks` table has `assigned_to` (uuid), `title`, `description`, `source`, `source_ref`, `company_id`, `status`, `priority`, `due_date`

### Approach
Create a backend function (edge function) that runs on a schedule or can be triggered manually. It will:

1. Query all leads in stages `estimation_ben`, `qc_ben`, `addendums` where `expected_close_date < today`
2. Check if a task already exists for each lead (using `source_ref` = lead ID and `source` = `pipeline_overdue`)
3. If no task exists, create one assigned to Ben with title like "Overdue: [Customer] - [Stage]"

### Implementation

**1. Create edge function `sync-overdue-tasks`**
- Queries overdue leads in Ben's stages
- Deduplicates using `source = 'pipeline_overdue'` and `source_ref = lead.id`
- Creates tasks assigned to Ben's profile ID with `priority = 'high'`, `due_date = expected_close_date`

**2. Add a "Sync Overdue Tasks" button to the Pipeline page header**
- Visible to admin/office roles
- Calls the edge function on click
- Shows toast with count of new tasks created

### Files to Create/Edit
- `supabase/functions/sync-overdue-tasks/index.ts` — new edge function
- `src/pages/Pipeline.tsx` — add sync button to header (small addition)

### Details

The edge function will:
```
SELECT leads with stage IN ('estimation_ben','qc_ben','addendums') AND expected_close_date < NOW()
JOIN customers for name
LEFT JOIN tasks WHERE source='pipeline_overdue' AND source_ref=lead.id AND status != 'completed'
INSERT new tasks only where no existing task found
```

Each created task:
- `title`: "Overdue: [Customer Name] – [Stage Label]"
- `assigned_to`: Ben's profile ID
- `source`: `pipeline_overdue`
- `source_ref`: lead ID (for deduplication)
- `priority`: `high`
- `due_date`: lead's `expected_close_date`
- `company_id`: from lead's `company_id`

