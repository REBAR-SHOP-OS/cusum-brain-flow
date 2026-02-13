

# Make Accounting Fully AI-Driven with Human Approvals, Follow-Ups, and Collections

## Overview

Transform the Accounting workspace from a passive data viewer into an **AI-driven command center** where Penny proactively manages collections, follow-ups, and financial actions -- all gated by human approval before execution.

---

## What Changes

### 1. New Database Table: `penny_collection_queue`

A structured queue for AI-generated collection and follow-up actions that require human approval before execution.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| company_id | uuid | Multi-tenant isolation |
| invoice_id | text | QuickBooks invoice reference |
| customer_name | text | For display |
| customer_email | text | For email actions |
| customer_phone | text | For call actions |
| amount | numeric | Outstanding balance |
| days_overdue | integer | Aging days |
| action_type | text | `email_reminder`, `call_collection`, `send_invoice`, `escalate` |
| action_payload | jsonb | Draft email body, call script, etc. |
| status | text | `pending_approval`, `approved`, `executed`, `rejected`, `failed` |
| priority | text | `low`, `medium`, `high`, `critical` |
| ai_reasoning | text | Why Penny recommends this action |
| approved_by | uuid | Who approved |
| approved_at | timestamptz | When approved |
| executed_at | timestamptz | When executed |
| execution_result | jsonb | Outcome details |
| followup_date | date | When to follow up next |
| followup_count | integer | How many times followed up |
| created_at | timestamptz | Default now() |

RLS: Authenticated users with accounting or admin role, filtered by company_id.

### 2. New Component: `AccountingActionQueue.tsx`

A dedicated "AI Actions" tab in the accounting workspace showing Penny's recommended actions in a prioritized queue:

- Grouped by priority (Critical / High / Medium / Low)
- Each card shows: customer, amount, days overdue, Penny's reasoning, and the proposed action (email draft / call script)
- **Approve** button executes the action (sends email, initiates call, sends invoice)
- **Reject** button dismisses with optional reason
- **Modify & Approve** lets users edit the draft before sending
- **Schedule** button sets a follow-up date
- Badge counters in the nav showing pending approvals

### 3. New Edge Function: `penny-auto-actions`

A cron-triggered (or on-demand) edge function that:

1. Reads overdue invoices from the QuickBooks mirror/API
2. Applies Penny's rule engine:
   - **7+ days overdue**: Queue a friendly email reminder (action_type: `email_reminder`)
   - **14+ days overdue**: Queue a call collection (action_type: `call_collection`)  
   - **30+ days overdue**: Queue an invoice re-send + firm email (action_type: `send_invoice`)
   - **60+ days overdue**: Queue escalation to CEO/Vizzy (action_type: `escalate`)
3. Uses Lovable AI (Gemini Flash) to generate personalized email drafts and call scripts based on customer history
4. Inserts into `penny_collection_queue` with `status: pending_approval`
5. Deduplicates: won't create a new action if one already exists for the same invoice in `pending_approval` status

### 4. New Edge Function: `penny-execute-action`

Executes approved actions:
- `email_reminder` / `send_invoice`: Calls the existing `quickbooks-oauth` send-invoice action or drafts a Gmail via the existing email infrastructure
- `call_collection`: Creates a `call_task` record and returns a call card for Penny
- `escalate`: Creates a `human_task` assigned to Vizzy (CEO agent)
- Updates `penny_collection_queue` status to `executed` with result

### 5. Enhanced `AccountingDashboard.tsx`

Add a new summary card: **"Penny's Queue"** showing:
- Pending approvals count (with badge)
- Total AR at risk
- Next follow-up due date
- Clicking navigates to the new "actions" tab

### 6. Enhanced `AccountingNavMenus.tsx`

Add "AI Actions" tab with a notification badge showing pending approval count.

### 7. Enhanced `AccountingAgent.tsx` (Penny Chat)

Update Penny's prompt to:
- Proactively mention pending actions from the queue in daily briefings
- Allow users to say "approve all low-risk" to batch-approve email reminders
- Allow "show my queue" to display pending actions inline
- After a collection call outcome is logged, auto-queue the next follow-up action

### 8. Enhanced `generate-suggestions` Edge Function

Add new Penny suggestion rules:
- "X invoices ready for collection email -- approve in AI Actions"
- "Customer Y has been followed up Z times with no payment -- escalate?"
- "Follow-up overdue: last contact was N days ago for Invoice #X"

---

## Technical Details

### Files Created (4 new)

| File | Purpose |
|------|---------|
| `src/components/accounting/AccountingActionQueue.tsx` | Main AI actions queue UI with approve/reject/schedule |
| `src/hooks/usePennyQueue.ts` | Hook for CRUD on `penny_collection_queue` with realtime |
| `supabase/functions/penny-auto-actions/index.ts` | AI-powered action generation engine |
| `supabase/functions/penny-execute-action/index.ts` | Action execution after approval |

### Files Modified (6)

| File | Changes |
|------|---------|
| `src/pages/AccountingWorkspace.tsx` | Add "actions" tab routing, listen for pending count |
| `src/components/accounting/AccountingNavMenus.tsx` | Add "AI Actions" nav item with badge |
| `src/components/accounting/AccountingDashboard.tsx` | Add Penny Queue summary card |
| `src/components/accounting/AccountingAgent.tsx` | Enhance prompt context with queue data, post-call auto-followup |
| `supabase/functions/generate-suggestions/index.ts` | Add follow-up overdue and batch-ready rules |
| `supabase/config.toml` | Register new edge functions |

### Database Migration

```sql
CREATE TABLE public.penny_collection_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  invoice_id text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  amount numeric DEFAULT 0,
  days_overdue integer DEFAULT 0,
  action_type text NOT NULL,
  action_payload jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending_approval',
  priority text NOT NULL DEFAULT 'medium',
  ai_reasoning text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb,
  followup_date date,
  followup_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for status/priority/action_type
-- RLS policies for authenticated users with company_id filter
-- Realtime enabled
```

### AI Action Generation Flow

```
Cron (every 4h) or Manual trigger
        |
        v
[penny-auto-actions]
  1. Read overdue invoices from qb_transactions mirror
  2. Check existing queue (skip duplicates)
  3. Apply aging rules (7d / 14d / 30d / 60d)
  4. Call Lovable AI to draft personalized emails/scripts
  5. Insert into penny_collection_queue (pending_approval)
        |
        v
[AccountingActionQueue UI]
  User sees: customer, amount, AI reasoning, draft email
  User clicks: Approve / Reject / Modify / Schedule
        |
        v
[penny-execute-action]
  Executes: send email / create call task / escalate
  Updates: status -> executed, logs result
  Auto-queues: next follow-up based on outcome
```

### Approval UI Pattern

Each action card in the queue:
- Shows the full draft (email body or call script) in an expandable section
- "Approve" sends it immediately
- "Edit & Approve" opens an inline editor
- "Reject" marks it dismissed with an optional reason
- "Schedule" sets a follow-up date and snoozes the action
- Color-coded by priority: red (critical/60d+), amber (high/30d+), blue (medium/14d+), gray (low/7d+)

