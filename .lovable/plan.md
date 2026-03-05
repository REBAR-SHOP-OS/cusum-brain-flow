

# Pipeline Cards — Odoo Exact Parity (Add, Don't Remove)

## What to Add

The main missing piece is Odoo's **activity type icons row** at the bottom of each card. In Odoo, each card shows small colored icons for pending activities (📧 email, 📞 call, ⏰ follow-up, etc.), color-coded by due date urgency (green=planned, orange=today, red=overdue). This is the core visual difference.

## Changes

### 1. `src/pages/Pipeline.tsx` — Batch-fetch pending activities per lead

Add a query to fetch `lead_activities` where `completed_at IS NULL AND due_date IS NOT NULL`, grouped by `lead_id` and `activity_type`. Pass this data down as a map (`Record<string, ActivityIcon[]>`) to `PipelineBoard → PipelineColumn → LeadCard`.

This avoids N+1 queries — one batch fetch for all visible leads.

### 2. `src/components/pipeline/LeadCard.tsx` — Add activity icons row + visual tweaks

**Add** (keep all existing elements):
- New prop: `pendingActivities: { type: string; dueDate: string }[]`
- Activity icons row between company name and bottom row — small colored icons for each pending activity type:
  - `email` → `Mail` icon
  - `call` → `Phone` icon
  - `follow_up` → `Clock` icon
  - `internal_task` → `ClipboardCheck` icon
  - `note` → `StickyNote` icon
  - `comment` → `MessageSquare` icon
- Each icon colored by due date vs today (green/orange/red) — identical to Odoo
- Change activity status icon from `AlignJustify` to `Clock`
- Enlarge salesperson avatar from `w-5 h-5` → `w-7 h-7`, text `text-[8px]` → `text-[10px]`

### 3. `src/components/pipeline/PipelineColumn.tsx` — Spacing

- Card gap from `space-y-1` to `space-y-1.5`

### 4. `src/components/pipeline/PipelineBoard.tsx` — Pass activities data through

Thread the `pendingActivitiesByLead` prop from Pipeline → PipelineBoard → PipelineColumn → LeadCard.

| File | Change |
|------|--------|
| `src/pages/Pipeline.tsx` | Batch-fetch pending activities, pass as prop |
| `src/components/pipeline/PipelineBoard.tsx` | Thread new prop |
| `src/components/pipeline/PipelineColumn.tsx` | Thread prop + spacing tweak |
| `src/components/pipeline/LeadCard.tsx` | Add activity icons row, fix icon, enlarge avatar |

