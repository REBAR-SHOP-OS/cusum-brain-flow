

## Fix: Station Dashboard -- Machine Isolation and Company/Scope Sorting

### Problem

The Station Dashboard (`/shopfloor/station`) displays all running and queued plans in flat lists without separating them by machine. This prevents operators from seeing which jobs belong to which machine, blocking independent simultaneous work across stations. Additionally, plans are not sorted by company name and then scope name.

### Root Cause

In `StationDashboard.tsx`, lines 29-30 create two flat arrays:
- `runningPlans` = all plans with status "running"
- `queuedPlans` = all plans with status draft/ready/queued

These are rendered as single flat lists with no machine grouping or company/scope sorting.

### Solution

#### File: `src/pages/StationDashboard.tsx`

**Change 1: Group plans by machine**

Replace the flat `runningPlans`/`queuedPlans` rendering with a per-machine grouping:

```text
Before:
  Live Queue: [Plan A, Plan B, Plan C]  (all machines mixed)
  Queued:     [Plan D, Plan E]          (all machines mixed)

After:
  Machine "GENSCO DTX-400"
    Live Queue: [Plan A]
    Queued:     [Plan D]
  
  Machine "MEP FALCON 20"
    Live Queue: [Plan B, Plan C]
    Queued:     [Plan E]
  
  Unassigned
    Queued:     [Plan F]
```

Each machine gets its own collapsible section with its own Live Queue and Queued sub-lists, enabling operators to focus on their station independently.

**Change 2: Sort by Company name, then Scope name**

Within each machine section, plans are sorted by:
1. `customer_name` (alphabetically, nulls last)
2. `name` (scope/manifest name, alphabetically)

#### File: `src/hooks/useCutPlans.ts`

No changes needed -- the hook already fetches `customer_name` via the projects/customers join. The sorting will be applied in the component.

### Technical Details

**New data flow in StationDashboard.tsx:**

```text
plans (from useCutPlans)
  |
  +-- Group by machine_id
  |     |
  |     +-- For each machine:
  |           +-- running plans (status = "running")
  |           +-- queued plans (status = draft/ready/queued)
  |           +-- Sort both lists by: customer_name ASC NULLS LAST, name ASC
  |
  +-- "Unassigned" group (machine_id = null)
        +-- Same sorting logic
```

**UI structure per machine group:**

```text
+-------------------------------------------------------+
| [Chevron] [Machine Icon] GENSCO DTX-400    3 JOBS     |
+-------------------------------------------------------+
|   LIVE (1)                                             |
|   [green dot] ACTIVE  Plan A  | Customer X | Pause/Complete |
|                                                        |
|   QUEUED (2)                                           |
|   [dot] DRAFT  Plan D  | Customer Y | Start           |
|   [dot] READY  Plan E  | Customer Z | Start           |
+-------------------------------------------------------+
```

### Summary of Changes

| File | Change |
|---|---|
| `src/pages/StationDashboard.tsx` | Group Live Queue and Queued lists by `machine_id`; sort within each group by `customer_name` then `name`; render each machine as a collapsible section |

### What This Enables

- Each machine station operates its own independent queue
- Operators see only the jobs assigned to their machine
- Jobs are clearly organized by company and scope name
- Multiple stations can work simultaneously without confusion
