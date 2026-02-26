

## Plan: Add "Today" (Orange) Pipeline Leads to Ben's Tasks

### Current State
The `sync-overdue-tasks` edge function only syncs **overdue** leads (red bar — `expected_close_date < today`). It creates tasks with `source: "pipeline_overdue"` for Ben's stages (`estimation_ben`, `qc_ben`, `addendums`).

The user wants **orange** leads (due today, `expected_close_date = today`) to also generate tasks.

### Data Check
- Currently 2 overdue leads already have tasks created
- Tomorrow (Feb 27) has 2 leads in `estimation_ben` that will become "today" leads
- 21 more leads with future dates in Ben's stages

### Changes

**1. Update `supabase/functions/sync-overdue-tasks/index.ts`**
- Change the query filter from `lt("expected_close_date", today)` to `lte("expected_close_date", today)` — this includes both overdue AND today's leads
- Use a different source tag `"pipeline_today"` for today-dated leads to distinguish from overdue ones, or simplify by using a single source `"pipeline_overdue"` for both (since the logic is the same — follow up needed)
- Adjust title prefix: "Due Today:" for today leads vs "Overdue:" for past leads
- Set priority to "medium" for today leads (vs "high" for overdue)

**2. Rename function context (optional clarity)**
- Keep same function name `sync-overdue-tasks` but update the description/message to mention "overdue & due-today"

### Implementation Detail

In the edge function, change line 25:
```
.lt("expected_close_date", today)
```
to:
```
.lte("expected_close_date", today)
```

Then in the task-creation map (line 50-65), check if the lead's date equals today to set appropriate title prefix and priority:
- If `expected_close_date === today` → title: `"Due Today: {customer} – {stage}"`, priority: `"medium"`, source: `"pipeline_today"`
- If `expected_close_date < today` → title: `"Overdue: {customer} – {stage}"`, priority: `"high"`, source: `"pipeline_overdue"`

Deduplication check updated to include both `pipeline_overdue` and `pipeline_today` sources.

