

# Sales AI Agent - Full Pipeline Assistant Upgrade

## Overview
Upgrade the Sales AI agent (Blitz) to be a comprehensive sales assistant directly integrated into the Pipeline. Currently, the AI only suggests next actions in the Lead Timeline tab. This upgrade adds a dedicated "AI Assistant" tab in the Lead Detail Drawer with full capabilities: follow-up drafting, reminder setting, quotation generation, lead scoring, email drafting, and stage recommendations.

## What Changes

### 1. New "AI" Tab in Lead Detail Drawer
Add a 7th tab to the Lead Detail Drawer called "AI" (with a Sparkles icon) that serves as Blitz's command center for each lead. It will contain:

- **Quick Action Buttons**: One-tap actions like "Draft Follow-Up", "Set Reminder", "Generate Quote", "Score Lead", "Suggest Next Step"
- **AI Response Area**: Displays Blitz's responses with rich markdown
- **Free-text Input**: Ask Blitz anything about this lead
- Responses stream inline within the drawer

### 2. Expand pipeline-ai Edge Function
Add new action types to the existing `pipeline-ai` edge function:

- `draft_followup` (already exists, will enhance with more context)
- `set_reminder` -- AI suggests a reminder date/message, then creates a task
- `generate_quote` -- AI drafts quotation line items based on lead context
- `score_lead` -- Returns a 0-100 score with reasoning
- `recommend_stage` -- Suggests which stage the lead should move to and why
- `draft_email` -- General email drafting for this lead (intro, check-in, proposal cover, etc.)
- `analyze` -- Free-form question about the lead answered with full context

### 3. Create LeadAIPanel Component
New component `src/components/pipeline/LeadAIPanel.tsx` that renders inside the drawer's AI tab:

- Grid of quick-action buttons at top (each triggers a specific pipeline-ai action)
- Chat-like response area below
- Free-text input at bottom for custom questions
- "Create Task" button on reminder/follow-up results to save to tasks table
- "Generate Quotation" button renders the existing QuotationTemplate with AI-suggested line items
- Loading states with skeleton animation

### 4. Reminder / Task Creation Integration
When Blitz suggests a reminder or follow-up:
- Show a "Create Task" button that opens the existing `CreateTaskDialog` pre-filled with AI-suggested title, description, due date, and source_ref set to the lead ID

### 5. Lead Card AI Indicator
Add a small sparkle icon on LeadCard when the lead has AI suggestions available (based on age/staleness heuristics -- leads older than 5 days without update get a subtle glow).

---

## Technical Details

### Files Modified

1. **`supabase/functions/pipeline-ai/index.ts`**
   - Add new action handlers: `score_lead`, `set_reminder`, `recommend_stage`, `draft_email`, `analyze`
   - Each uses structured tool calling for consistent JSON output
   - Enhance `draft_followup` with more lead context (metadata, customer info)
   - Add `generate_quote` that returns structured line items matching QuotationData interface

2. **`src/components/pipeline/LeadDetailDrawer.tsx`**
   - Add 7th tab "AI" with Sparkles icon
   - Import and render `LeadAIPanel` in the new tab
   - Update TabsList grid-cols from 6 to 7

3. **`src/components/pipeline/LeadCard.tsx`**
   - Add subtle Sparkles icon for stale leads (no update in 5+ days, not won/lost)

### Files Created

4. **`src/components/pipeline/LeadAIPanel.tsx`**
   - Quick action grid (6 buttons)
   - AI response display with markdown rendering
   - Free-text input with send button
   - Task creation integration via CreateTaskDialog
   - Quote preview integration
   - Loading/empty states

### Edge Function Changes (pipeline-ai)
- `score_lead`: Returns `{ score: number, factors: string[], recommendation: string }`
- `set_reminder`: Returns `{ suggested_date: string, message: string, priority: string }`
- `recommend_stage`: Returns `{ current: string, recommended: string, reason: string, confidence: number }`
- `draft_email`: Returns `{ subject: string, body: string, tone: string }`
- `generate_quote`: Returns `{ items: LineItem[], notes: string, validity_days: number }`
- `analyze`: Returns `{ answer: string }` (free-form response)

### No Database Changes Required
All features use existing tables (leads, lead_activities, tasks). The AI responses are displayed in real-time and task creation uses the existing tasks table.

