

# Pipeline Page: Fit-to-Page Layout + Blitz AI Agent Button

## Overview
Two changes to the Pipeline page:
1. **Fit to page** -- Make the pipeline board fill the full viewport height so columns stretch to fit the screen without unnecessary scrolling at the page level
2. **Add Blitz AI Agent button** -- Add a prominent "Blitz AI" button in the Pipeline header (top-right area, near "Add Lead") that opens a side sheet with the sales accountability agent

## What Changes

### 1. Fit-to-Page Layout
- Update `Pipeline.tsx` to use `h-screen` / `flex flex-col` so the header stays fixed and the board fills remaining space
- Update `PipelineBoard.tsx` to use `flex-1 overflow-hidden` with columns that scroll independently within their allocated height
- This eliminates page-level scrollbar and makes it feel like a proper Kanban app

### 2. Blitz AI Agent Button (Sales Accountability)
Add a "Blitz AI" button with a Sparkles icon in the Pipeline header toolbar (next to "Add Lead"). Clicking it opens a **Sheet (side panel)** with a full Blitz chat interface focused on **sales team accountability**:

- **Pipeline Overview**: Blitz analyzes the full pipeline and flags issues (stale leads, missing follow-ups, unassigned opportunities)
- **Accountability Report**: Shows which salespeople are falling behind on follow-ups, have stale leads, or are missing quotations
- **Quick Actions**: "Run Pipeline Audit", "Stale Lead Report", "Follow-up Gaps", "Revenue Forecast"
- **Free-text input**: Ask Blitz anything about the pipeline (e.g., "Which leads haven't been touched in 2 weeks?")

The agent calls the existing `pipeline-ai` edge function with a new `pipeline_audit` action that receives aggregate pipeline stats instead of a single lead.

### 3. Edge Function Update
Add a `pipeline_audit` action to `pipeline-ai/index.ts` that accepts pipeline-level stats (total leads per stage, stale count, salesperson activity) and returns an accountability report with markdown formatting.

## Technical Details

### Files Modified

1. **`src/pages/Pipeline.tsx`**
   - Wrap page in `h-screen flex flex-col` layout
   - Add "Blitz AI" button next to "Add Lead" in the header
   - Add Sheet component for the Blitz side panel
   - Pass pipeline summary data to the agent panel

2. **`src/components/pipeline/PipelineBoard.tsx`**
   - Add `flex-1 overflow-hidden` to the board container
   - Ensure columns use `overflow-y-auto` with max height from parent

3. **`src/components/pipeline/PipelineColumn.tsx`** (if exists)
   - Ensure column content scrolls independently

4. **`supabase/functions/pipeline-ai/index.ts`**
   - Add `pipeline_audit` action that accepts aggregate stats
   - System prompt instructs Blitz to act as an accountability partner
   - Returns structured markdown report: stale leads, missing follow-ups, salesperson rankings, recommended actions

### Files Created

5. **`src/components/pipeline/PipelineAISheet.tsx`**
   - Side sheet with Blitz branding (TrendingUp icon, "Blitz - Sales Command")
   - Quick action buttons: "Pipeline Audit", "Stale Leads", "Follow-up Gaps", "Revenue Forecast"
   - Markdown response area for AI output
   - Free-text input for custom questions
   - Passes pipeline summary (lead counts by stage, stale count, top salesperson stats) to the edge function

### Edge Function - pipeline_audit action
The new action accepts:
```
{ 
  pipelineStats: { total, byStage, staleCount, salespersonActivity },
  action: "pipeline_audit",
  userMessage?: string 
}
```
Returns accountability-focused markdown report identifying gaps and recommending specific actions with owner assignments.

