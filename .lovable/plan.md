

## Fix: Station Page Should Only Show Items for the Active Project

### Problem
The station page (`/shopfloor/station/:machineId`) displays barlist items from ALL projects assigned to the machine. The screenshot shows items from multiple projects (DWG# R01 and DWG# SD01) mixed together. Items should be isolated to a single project at a time.

### Root Cause
In `src/hooks/useStationData.ts`:
- **Bender path** (line 49-54): Fetches all bend items company-wide with no project filter
- **Cutter path** (line 69-74): Fetches all cut plans for the machine regardless of project

The `StationView` has client-side project filter pills, but they are optional and only appear when multiple projects are present. There is no server-side project isolation.

### Solution
Add `project_id` filtering to the `useStationData` hook and enforce project selection in the station view.

### Changes

**File: `src/hooks/useStationData.ts`**
- Add an optional `projectId` parameter to the hook signature
- **Bender query**: When `projectId` is provided, add `.eq("cut_plans.project_id", projectId)` to scope items to that project only
- **Cutter query**: When `projectId` is provided, add `.eq("project_id", projectId)` to the `cut_plans` query
- Include `projectId` in the query key for proper cache isolation

**File: `src/pages/StationView.tsx`**
- Import `useWorkspace` from `WorkspaceContext`
- Read `activeProjectId` from workspace context
- Pass `activeProjectId` to `useStationData` as the `projectId` filter
- Keep the existing client-side project filter pills as a secondary filter for when no workspace project is selected
- When `activeProjectId` is set, auto-scope data to that project without needing pill selection

### Technical Detail

In `useStationData.ts`, update the hook signature:
```typescript
export function useStationData(
  machineId: string | null, 
  machineType?: string, 
  projectId?: string | null
)
```

Bender query addition (after line 53):
```typescript
if (projectId) query = query.eq("cut_plans.project_id", projectId);
```

Cutter query addition (after line 73):
```typescript
if (projectId) query = query.eq("project_id", projectId);
```

In `StationView.tsx`, pass the workspace project:
```typescript
const { activeProjectId } = useWorkspace();
const { groups, items, isLoading: dataLoading, error } = useStationData(
  machineId || null, 
  machine?.type, 
  activeProjectId
);
```

This ensures the database query itself is scoped to the active project, preventing cross-project data from being fetched at all. The existing pill filters remain as a fallback when no workspace project is selected.
