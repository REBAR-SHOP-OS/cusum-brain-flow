

## Fix: Send Individual Lead Details to Blitz So It Can List Them

### The Problem
When Blitz reports "80 unassigned opportunities," it cannot list them because the `buildPipelineStats` function only sends summary numbers (counts by stage, by salesperson, totals). The AI never receives individual lead names or details.

### The Fix

**File: `src/components/pipeline/PipelineAISheet.tsx`**

Expand the `buildPipelineStats` function to include a list of individual leads grouped by relevant criteria. Specifically:

1. Add an `unassigned` array containing each unassigned lead's title, stage, value, and age in days
2. Add a `staleLeads` array with similar detail for stale leads
3. Cap each list at ~200 entries to stay within AI token limits

This way, when a user asks "list unassigned opportunities," Blitz will have the actual lead names to enumerate.

### Technical Details

Update `buildPipelineStats` (lines 55-82) to also collect:

```typescript
const unassignedLeads: { title: string; stage: string; value: number; days: number }[] = [];
const staleLeadsList: { title: string; stage: string; salesperson: string; daysSinceUpdate: number }[] = [];

// Inside the forEach loop:
if (sp === "Unassigned") {
  unassignedLeads.push({
    title: lead.title,
    stage: lead.stage,
    value,
    days: daysSince,
  });
}
if (daysSince >= 5 && lead.stage !== "won" && lead.stage !== "lost") {
  staleLeadsList.push({
    title: lead.title,
    stage: lead.stage,
    salesperson: sp,
    daysSinceUpdate: daysSince,
  });
}

// Return with the new arrays (capped at 200 each):
return {
  total: leads.length,
  byStage,
  bySalesperson,
  staleCount,
  totalValue,
  weightedValue,
  unassignedLeads: unassignedLeads.slice(0, 200),
  staleLeadsList: staleLeadsList.slice(0, 200),
};
```

No backend or edge function changes needed -- the `pipeline-ai` function already serializes the full `pipelineStats` object into the AI prompt via `JSON.stringify`.

