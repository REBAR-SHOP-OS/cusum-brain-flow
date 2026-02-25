

## Group Machine Queues by Project Name

### Problem
Within each machine section on the Station Dashboard, plans are listed flat without any project grouping. The user wants plans organized into project name folders inside each machine.

### Changes

**File: `src/components/shopfloor/MachineGroupSection.tsx`**

Modify the component to sub-group plans by `project_name` (or `customer_name`) within both the "Live" and "Queued" sections:

1. Add a helper function to group `CutPlan[]` by `project_name`:
   ```typescript
   function groupByProject(plans: CutPlan[]) {
     const map = new Map<string, CutPlan[]>();
     for (const plan of plans) {
       const key = plan.project_name || plan.customer_name || "Unassigned";
       if (!map.has(key)) map.set(key, []);
       map.get(key)!.push(plan);
     }
     return [...map.entries()].sort((a, b) => 
       a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0])
     );
   }
   ```

2. Replace flat `runningPlans.map(...)` and `queuedPlans.map(...)` with nested rendering:
   - Each project group gets a collapsible folder header with `FolderOpen` icon and project name
   - Plans within each folder are rendered as `PlanRow` components
   - Badge showing count of plans per project folder

```text
Machine Section (e.g. "GENSCO DTX 400")
├── LIVE (2)
│   ├── 📁 Project Alpha (1)
│   │   └── PlanRow: Cut Plan #1
│   └── 📁 Project Beta (1)
│       └── PlanRow: Cut Plan #2
└── QUEUED (5)
    ├── 📁 Project Alpha (3)
    │   ├── PlanRow: Cut Plan #3
    │   ├── PlanRow: Cut Plan #4
    │   └── PlanRow: Cut Plan #5
    └── 📁 Project Beta (2)
        ├── PlanRow: Cut Plan #6
        └── PlanRow: Cut Plan #7
```

3. Project folders default to open, each with a small collapsible toggle

### Technical Details
- Single file change: `src/components/shopfloor/MachineGroupSection.tsx`
- Groups by `plan.project_name`, falls back to `plan.customer_name`, then "Unassigned"
- No database changes needed
- Sorting within folders preserved (existing `sortPlans` logic in parent)

