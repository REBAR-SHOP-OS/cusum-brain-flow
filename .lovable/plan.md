

# Quick Wins Implementation Plan

## What already exists
- **Stale lead detection**: `PipelineAlerts.tsx` already flags leads with no update in 14+ days, and `PipelineReporting.tsx` exports stale leads. However, there is no **dedicated stale dashboard** with 7/14/30-day breakdowns, owner grouping, and actionable buttons.
- **Activity system**: `ScheduledActivities.tsx` allows scheduling activities per lead. No enforcement that a next activity must exist.
- **Stage gates**: `pipelineTransitionGates.ts` + `handleStageChange` in Pipeline.tsx already supports blocking transitions with modal gates.
- **Intelligence hub**: 13 tabs at `/pipeline/intelligence` -- alerts, analytics, SLA, etc.

## 4 Quick Wins to Implement

### 1. Stale Pipeline Dashboard (new component + new Intelligence tab)
Create `src/components/pipeline/intelligence/StalePipelineDashboard.tsx`:
- Three-tier view: 7-day, 14-day, 30-day staleness buckets
- Group by stage and by owner (salesperson)
- Show lead title, stage, value, days since last update, last activity date
- "Open Lead" action button per row
- Total value at risk per bucket
- Add as a new "Stale" tab in `PipelineIntelligence.tsx`

### 2. Unattended Leads List (new component + new Intelligence tab)  
Create `src/components/pipeline/intelligence/UnattendedLeadsDashboard.tsx`:
- Query `scheduled_activities` to find open leads with **zero future-dated activities**
- Show lead title, stage, value, owner, days since creation
- Sorted by value descending (highest-value unattended leads first)
- "Schedule Activity" quick action that opens the lead detail
- Summary banner: "X leads ($Y value) have no next step scheduled"
- Add as a new "Unattended" tab in `PipelineIntelligence.tsx`

### 3. Mandatory Next Activity for "New" and "Telephonic Enquiries" stages
In `src/lib/pipelineTransitionGates.ts`:
- Add a new gate type `"next_activity"` that fires when moving **out of** `new` or `telephonic_enquiries` to any forward stage
- The gate checks whether the lead has at least one future-dated scheduled activity
- If not, show a modal requiring the user to schedule one before proceeding

In `src/pages/Pipeline.tsx`:
- Wire the new gate into `handleStageChange` alongside existing qualification/pricing/loss gates
- Add a simple `NextActivityGateModal` component that embeds the existing `ScheduledActivities` form and only allows proceeding once an activity exists

### 4. Handoff Template for QC/Estimation Requests
Create `src/components/pipeline/HandoffTemplateDialog.tsx`:
- Pre-structured note template with fields: Scope Summary, Due Date, Files Needed, Blockers
- Triggers automatically when moving a lead into any `qc_*` or `estimation_*` stage (via transition gates)
- On submit, creates a `lead_activities` entry with type `internal_note` and the structured content
- Uses the existing gate infrastructure (new gate type `"handoff"`)

## Files to create/modify

| File | Action |
|------|--------|
| `src/components/pipeline/intelligence/StalePipelineDashboard.tsx` | **Create** -- 7/14/30-day stale dashboard |
| `src/components/pipeline/intelligence/UnattendedLeadsDashboard.tsx` | **Create** -- leads with no next activity |
| `src/components/pipeline/HandoffTemplateDialog.tsx` | **Create** -- structured handoff note modal |
| `src/components/pipeline/NextActivityGateModal.tsx` | **Create** -- gate modal requiring next activity |
| `src/lib/pipelineTransitionGates.ts` | **Edit** -- add `next_activity` and `handoff` gate types |
| `src/pages/PipelineIntelligence.tsx` | **Edit** -- add Stale and Unattended tabs |
| `src/pages/Pipeline.tsx` | **Edit** -- wire new gate modals into `handleStageChange` flow |

No database changes required. All features use existing tables (`leads`, `scheduled_activities`, `lead_activities`).

