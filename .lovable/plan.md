

## Plan: Show Customer Name on Production Cards

### Problem
The Production Cards on the station page show the Mark number and project name, but not the customer name. The data query (`useStationData`) doesn't fetch the customer name from the `projects → customers` join chain.

### Changes

**1. Update `src/hooks/useStationData.ts`**
- Add `customer_name: string | null` to the `StationItem` interface
- **Bender query**: Update the select to include `customers(name)` via the projects join: change `cut_plans!inner(id, name, project_name, project_id, company_id)` to `cut_plans!inner(id, name, project_name, project_id, company_id, projects(customers(name)))`
- Map `customer_name` from `cut_plans.projects?.customers?.name`
- **Cutter query**: Update the `cut_plans` select from `"id, name, project_name, project_id, machine_id"` to `"id, name, project_name, project_id, machine_id, projects(customers(name))"` and map `customer_name` from `plan.projects?.customers?.name`

**2. Update `src/components/shopfloor/ProductionCard.tsx`**
- Below the existing "Mark / DWG" heading area (around line 96-107), add the customer name display:
  - Show `item.customer_name` as a small label above or below the mark number (e.g., `text-xs text-muted-foreground`)
  - Only render when `item.customer_name` is present

### Files
- `src/hooks/useStationData.ts` — add customer_name to interface + both queries
- `src/components/shopfloor/ProductionCard.tsx` — render customer name on card

