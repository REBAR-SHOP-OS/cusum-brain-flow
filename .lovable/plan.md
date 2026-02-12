

# Link Lead Details to Real Communications

## Problem
When viewing a lead like "12964 - Oakville Fire Hall 9 - Scope of Work", the Email tab only shows the single email stored in the lead's `metadata` field. It does not show the actual related communications from the `communications` table. The customer info also doesn't display properly because the lead may not have a linked `customer_id`.

The user wants: when opening any lead, the detail view should show ALL related emails/calls/SMS from the `communications` table, and the customer info should be accurate.

## Root Cause
- `LeadEmailThread` only reads from `lead.metadata` (a single snapshot email), not from the `communications` table
- The `communications` table has a `customer_id` column but no `lead_id` column to directly link communications to leads
- Many leads (especially Odoo-synced ones) share a `customer_id` with communications, but `LeadEmailThread` never queries communications

## Solution

### 1. Add `lead_id` column to `communications` table
- Add an optional `lead_id` UUID FK to `communications` referencing `leads(id)`
- This allows direct linking in the future (e.g., when emails are explicitly attached to a lead)

### 2. Rewrite `LeadEmailThread` to fetch from `communications`
- Accept `leadId` and `customerId` as props (in addition to existing metadata/notes)
- Query `communications` table matching by:
  - `lead_id` (exact match, if set)
  - OR `customer_id` (same customer as the lead)
  - OR subject keyword match (e.g., "Oakville Fire Hall" from the lead title)
- Display the results as a real email thread with sender avatars, timestamps, and previews
- Fall back to the existing metadata-based display if no communications are found

### 3. Update `LeadDetailDrawer` to pass new props
- Pass `lead.id` and `lead.customer_id` to `LeadEmailThread`
- Extract project/customer name from the lead title (e.g., "Oakville Fire Hall 9" from "S02863, 12964 - Oakville Fire Hall 9 - Scope of Work") for keyword matching

### 4. Flow After Fix

```text
User opens lead detail drawer
    |
    v
Email tab loads LeadEmailThread
    |
    v
Query communications WHERE:
  lead_id = this lead
  OR customer_id = lead's customer_id
  OR subject matches lead title keywords
    |
    v
Display all matching emails, calls, SMS as timeline
    |
    v
Fallback: show metadata email if no communications found
```

## Technical Details

### Database Migration
```sql
ALTER TABLE public.communications
  ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX idx_communications_lead_id ON public.communications(lead_id);
```

### File Changes

**`src/components/pipeline/LeadEmailThread.tsx`**
- Add `leadId` and `customerId` props
- Add a `useQuery` hook to fetch from `communications` table using the matching logic above
- Keep the existing metadata-based rendering as fallback
- Render communications as message bubbles (reuse existing `MessageBubble` component)

**`src/components/pipeline/LeadDetailDrawer.tsx`**
- Pass `leadId={lead.id}` and `customerId={lead.customer_id}` to `LeadEmailThread`

This ensures every lead shows its full communication history -- emails, calls, and SMS -- from the unified `communications` table, not just a single metadata snapshot.
