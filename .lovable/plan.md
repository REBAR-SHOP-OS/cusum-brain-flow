

# Pipeline: AI-Driven + Manual Dual-Mode

## What You Get

A new **AI Autopilot toggle** on the Pipeline page that lets you switch between:

- **Manual Mode** (current behavior): You drag leads, send emails, change stages yourself
- **AI Mode**: Blitz (or Gauge) automatically scores leads, recommends stage moves, queues follow-up emails, and flags stale leads -- all with your approval before execution

## How It Works

### 1. Pipeline Mode Toggle (Header)

Add a toggle switch in the Pipeline header bar (next to the "New" button):

```
[Manual] [AI Autopilot]
```

- Default: Manual (current behavior, nothing changes)
- When AI Autopilot is ON: a persistent sidebar panel appears showing AI-queued actions
- Mode preference saved to `localStorage` so it persists between sessions

### 2. New Database Table: `pipeline_ai_actions`

Stores AI-generated action items that await human approval (like Penny's collection queue pattern):

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| lead_id | UUID FK | Which lead |
| action_type | TEXT | `move_stage`, `send_followup`, `set_reminder`, `flag_stale`, `score_update` |
| status | TEXT | `pending`, `approved`, `executed`, `dismissed` |
| priority | TEXT | `critical`, `high`, `medium`, `low` |
| ai_reasoning | TEXT | Why the AI suggests this |
| suggested_data | JSONB | Stage name, email draft, score, etc. |
| company_id | UUID | RLS scoping |
| created_by | UUID | User who triggered the scan |
| created_at / updated_at | TIMESTAMPTZ | Timestamps |

RLS: company-scoped read/write for authenticated users.

### 3. AI Autopilot Panel (Right Sidebar)

When AI mode is ON, a collapsible right panel shows:

- **Pending Actions** count badge on the toggle
- Each action card shows: Lead name, action type icon, AI reasoning, and Approve/Dismiss buttons
- Action types with icons:
  - **Move Stage** (ArrowRight): "Move 'ABC Corp' from Estimation to Qualified — no activity in 12 days, estimation complete"
  - **Send Follow-up** (Mail): Shows draft email preview, Edit + Approve
  - **Score Update** (BarChart3): "Score dropped from 72 to 45 — no response in 14 days"
  - **Flag Stale** (AlertTriangle): "Lead inactive 10+ days, recommend follow-up or archive"
  - **Set Reminder** (Calendar): "Schedule call for Thursday — last contact was 7 days ago"
- Bulk actions: "Approve All", "Dismiss All"

### 4. AI Scan Trigger

- **Manual trigger**: "Scan Now" button in the AI panel header (like Penny's pattern)
- **Auto-scan**: When AI mode is ON and pipeline loads, auto-scan runs once (debounced, max once per 30 minutes per user)
- Scan calls the existing `pipeline-ai` edge function with a new `action: "autopilot_scan"` that:
  1. Analyzes all leads for staleness, stage mismatches, missing follow-ups
  2. Returns structured action items via tool calling
  3. Frontend inserts them into `pipeline_ai_actions` table

### 5. Action Execution

When user approves an action:
- **move_stage**: Calls existing `updateStageMutation` to move the lead
- **send_followup**: Calls existing email-sending flow (or queues for manual send)
- **score_update**: Updates lead metadata with new AI score
- **set_reminder**: Creates a task via `CreateTaskDialog` pattern
- **flag_stale**: Adds a visual badge on the lead card + creates notification

### 6. Visual Indicators on Lead Cards (AI Mode Only)

When AI Autopilot is ON, lead cards get subtle indicators:
- Small colored dot (orange = AI action pending, green = recently actioned)
- Tooltip showing the pending AI suggestion

### 7. Edge Function Update (`pipeline-ai`)

Add a new `autopilot_scan` action handler that:
- Takes the full pipeline stats (already built by `buildPipelineStats`)
- Returns structured array of suggested actions via tool calling
- Each action includes: `lead_id`, `action_type`, `priority`, `reasoning`, `suggested_data`

## Files Changed

| File | Change |
|------|--------|
| **Database migration** | Create `pipeline_ai_actions` table + RLS |
| `src/pages/Pipeline.tsx` | Add mode toggle, AI panel trigger, pass mode to board |
| `src/components/pipeline/PipelineAIActions.tsx` | **NEW** -- AI actions sidebar panel |
| `src/hooks/usePipelineAI.ts` | **NEW** -- Hook for fetching/approving/dismissing AI actions |
| `supabase/functions/pipeline-ai/index.ts` | Add `autopilot_scan` action handler |
| `src/components/pipeline/LeadCard.tsx` | Add AI action pending indicator dot |

## What Does NOT Change

- Manual drag-and-drop behavior -- fully preserved
- Existing Blitz/Gauge AI Sheet -- untouched (complementary feature)
- Lead form, detail drawer, filters, search -- all untouched
- Odoo sync, RFQ scan -- untouched
- All other modules -- untouched

## Guards

- AI actions always require human approval before execution (no auto-execute)
- Scan rate-limited: max once per 30 minutes per user via `localStorage` timestamp
- Dismissed actions don't resurface for 7 days (stored in `suggested_data.dismissed_until`)
- AI mode toggle is admin-only by default (configurable)
- Table has validation trigger for status and action_type fields

