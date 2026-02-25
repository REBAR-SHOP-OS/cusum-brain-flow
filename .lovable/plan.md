

## Fix: Plans Not Appearing on Machine Stations

### Root Cause
The active plan "1000197066 ONTARIO INC." has `machine_id = NULL` (unassigned). The station view strictly filters by `machine_id`, so when you enter any machine like GENSCO DTX 400, it correctly shows nothing — the plan was never assigned to it.

This also causes ActiveProductionHub to show "No machines currently running" since it only tracks machines with assigned plans.

### Solution: Two Changes

**1. ActiveProductionHub — Show unassigned running plans (lines 76-82)**

Add an "Unassigned Active Jobs" card when plans are running without a machine. Include a dropdown to assign them to a machine directly from the hub.

```text
Active Production Hub
├── Machine cards (existing, for assigned plans)
└── NEW: "Unassigned Active Jobs" card
    ├── Plan name + status
    ├── "Assign to Machine" dropdown (Select component)
    └── On assign → updates cut_plans.machine_id → plan appears on machine station
```

**2. MachineGroupSection "Unassigned" section — Add machine assignment**

In the UNASSIGNED section at the bottom of Station Dashboard (where the plan currently shows), add a "Assign to Machine" dropdown on each plan row so operators can quickly route work to a specific machine.

### Changes by File

**`src/components/shopfloor/ActiveProductionHub.tsx`**
- Filter unassigned running plans: `activePlans.filter(p => !p.machine_id && p.status === "running")`
- Change empty state condition to also check unassigned plans
- Add an "Unassigned Jobs" card with each plan showing a machine selector dropdown
- On selection, update `cut_plans.machine_id` via Supabase and invalidate queries

**`src/components/shopfloor/MachineGroupSection.tsx`**
- Accept optional `machines` prop (list of available machines)
- When `machineName === "Unassigned"`, show a small "Assign" dropdown next to each PlanRow
- Dropdown lists all available machines; selecting one updates `cut_plans.machine_id`

**`src/pages/StationDashboard.tsx`**
- Pass `machines` list to the Unassigned `MachineGroupSection` so the assign dropdown has data

### Technical Details
- Assignment updates `cut_plans.machine_id` via `supabase.from("cut_plans").update({ machine_id }).eq("id", planId)`
- Realtime subscriptions already listen to `cut_plans` changes, so the UI will auto-refresh
- No database schema changes needed — `machine_id` column already exists on `cut_plans`
- After assignment, the plan will immediately appear on that machine's station view (existing query on line 79 of `useStationData.ts` handles this)

