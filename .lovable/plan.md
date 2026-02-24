

## Fix: Live Queue Should Only Show Active (Running) Jobs

### Problem
The "Live Queue" section on `/shopfloor/station` (StationDashboard) displays ALL cut plans with statuses `draft`, `ready`, `queued`, and `running`. Users expect this section to only show jobs that have been started (status = `running`), not unstarted/queued ones.

### Root Cause
In `src/pages/StationDashboard.tsx`, line 29-31:
```tsx
const activePlans = plans.filter(p =>
  ["draft", "ready", "queued", "running"].includes(p.status)
);
```
This filter is too broad -- it includes drafts and queued plans that haven't been started yet.

### Solution
Split the plans into two categories:

1. **Running plans** (status = `running`) -- shown in the "Live Queue" section as active jobs
2. **Queued plans** (status = `draft`, `ready`, `queued`) -- shown in a separate "Queued" section below, where operators can start them

### Changes

**File: `src/pages/StationDashboard.tsx`**

1. Create two filtered lists instead of one:
   - `runningPlans` = plans with status `running`
   - `queuedPlans` = plans with status `draft`, `ready`, or `queued`

2. Update the "Live Queue" section to only render `runningPlans` -- these are the actively started jobs with Pause/Complete actions

3. Add a separate "Queued" section below that renders `queuedPlans` -- these show the Start button to begin work

4. Update the counter badge next to "Live Queue" to reflect only running plans count

This way the Live Queue accurately represents only work in progress, and queued/unstarted jobs are visually separated.

