
# Auto-Create Follow-Up Activity After Sending Prospect Email

## Overview
After sending an introduction or follow-up email from the Prospecting page, automatically log a follow-up activity on the associated lead and keep the prospect in the "prospecting" pipeline stage until it converts to a real lead.

## Changes

### 1. Update `src/pages/Prospecting.tsx` -- Enhance `markEmailedMutation`

Currently, `onSent` only updates the prospect status to "emailed". We'll expand it to also:

- **Create a follow-up activity** on the linked lead (if the prospect has been approved and has a `lead_id`). The activity will be:
  - `activity_type`: "follow_up"
  - `title`: "Follow up with [contact_name] at [company_name]"
  - `description`: "Introduction email sent on [date]. Follow up in 3-5 business days."
  - `due_date`: 5 business days from now
- **If no lead exists yet** (prospect hasn't been approved), auto-approve the prospect first (creating the lead in "prospecting" stage), then log the follow-up activity on the new lead.
- Show a toast confirming: "Email sent and follow-up scheduled"

### 2. Update `src/pages/Prospecting.tsx` -- Ensure "prospecting" stage persists

The approve mutation already creates leads with `stage: "prospecting"`. No change needed there -- the prospect stays in the prospecting pipeline stage. It only becomes a "real lead" when a user manually moves it to "qualified" or another stage in the Pipeline page.

### 3. Update `onSent` callback (lines 306-309)

Change the `onSent` handler to call a new combined mutation that:
1. Updates prospect status to "emailed"
2. If no `lead_id`, creates a lead (approve flow) with stage "prospecting"
3. Inserts a `lead_activities` row with type "follow_up" and a due date 5 business days out
4. Invalidates both "prospects" and "leads" queries

## Technical Details

- The new mutation will be called `emailAndFollowUpMutation`
- Due date calculation: `new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)` (5 days)
- The activity is inserted into `lead_activities` with columns: `lead_id`, `company_id`, `activity_type`, `title`, `description`, `due_date`, `created_by`
- If the prospect already has a `lead_id` (was previously approved), we use that directly; otherwise we create the lead first
- The prospect remains visible on the Prospecting page with "emailed" status badge
