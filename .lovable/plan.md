

# Fix: Missing Records in Pipeline View

## Problem

After thorough investigation, the pipeline data-fetching logic is correct (it paginates all records), and all current lead stages match the hardcoded `PIPELINE_STAGES` list. However, there is a structural vulnerability: if a lead has a `stage` value that doesn't match any entry in the hardcoded `PIPELINE_STAGES` array, it silently disappears from the board. This can happen after an Odoo sync introduces a new or renamed stage.

Additionally, there is no visual feedback when filters are actively hiding records, which can make it seem like records are missing.

## Root Cause

In `src/pages/Pipeline.tsx` (line 280-308), the `leadsByStage` grouping only iterates over `PIPELINE_STAGES`. Any lead with a stage value outside this list is dropped.

## Plan

### 1. Add a catch-all "Unknown Stage" column

**File**: `src/pages/Pipeline.tsx`

- After grouping leads into known stages, detect any leads whose `stage` doesn't match any `PIPELINE_STAGES` entry
- Dynamically create an "Unknown / Unmapped" column for these orphaned leads
- This ensures 100% of leads are always visible on the board

### 2. Add filter-active indicator

**File**: `src/pages/Pipeline.tsx`

- When `filteredLeads.length < leads.length`, the header already shows a count like "(45 / 2878)". This is sufficient, but we should ensure it's prominent enough.

### Technical Details

In `src/pages/Pipeline.tsx`, modify the `leadsByStage` memo (around line 268-309):

```text
// After the existing PIPELINE_STAGES.forEach loop, add:
const knownStageIds = new Set(PIPELINE_STAGES.map(s => s.id));
const unmappedLeads = filteredLeads.filter(l => !knownStageIds.has(l.stage));
if (unmappedLeads.length > 0) {
  grouped["__unmapped__"] = unmappedLeads;
}
```

And ensure the `orderedStages` passed to `PipelineBoard` includes a dynamic entry for `__unmapped__` when such leads exist:

```text
const finalStages = useMemo(() => {
  const base = orderedStages;
  if (leadsByStage["__unmapped__"]?.length > 0) {
    return [...base, { id: "__unmapped__", label: "Unmapped Stage", color: "bg-red-500" }];
  }
  return base;
}, [orderedStages, leadsByStage]);
```

This is a small, focused change -- 2 files touched, no database changes needed.

