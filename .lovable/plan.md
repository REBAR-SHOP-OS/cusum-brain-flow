

## Send Email Notifications to Assignees on Stage Change & Log Notes

### What It Does
Whenever a sales lead's stage changes or a log note is added, all assignees receive an email notification. Vendor (external) assignees only receive the email if they are @mentioned in the log note. Emails include the note text (no attachments) and a direct link to the record.

### Architecture

An edge function `notify-lead-assignees` handles the email sending logic server-side. The frontend calls it after two events:
1. **Log note added** — from `SalesLeadChatter.tsx` after note creation
2. **Stage changed** — from `SalesPipeline.tsx` after stage update

The edge function:
- Fetches the lead title from `sales_leads`
- Fetches all assignees from `sales_lead_assignees` + their profile emails from `profiles`
- Determines which are internal (`@rebar.shop`) vs vendor (external)
- Internal assignees always get emailed
- Vendor assignees only get emailed if their `full_name` appears in the note body (i.e., they were @mentioned)
- Sends emails via the existing `gmail-send` function (reuses Gmail OAuth infrastructure)
- Email body: plain text with note content + direct link to the record

### Changes

**File**: `supabase/functions/notify-lead-assignees/index.ts` (NEW)
- Edge function that accepts: `sales_lead_id`, `event_type` ("note" | "stage_change"), `note_text`, `new_stage`, `actor_name`
- Fetches assignees + profiles (email, full_name)
- Filters vendors based on @mention in note text
- Sends email to each qualified assignee via Gmail API (using shared refresh token)
- Record link: `https://cusum-brain-flow.lovable.app/sales/pipeline?lead={id}`

**File**: `src/components/sales/SalesLeadChatter.tsx`
- After successful note creation (`onSuccess` in `create.mutate` at line 196), invoke `notify-lead-assignees` with the note body text

**File**: `src/pages/sales/SalesPipeline.tsx`
- In `handleStageChange` (line 235), after `updateLead.mutate`, invoke `notify-lead-assignees` with event_type "stage_change" and the new stage name

**File**: `src/hooks/useSalesLeads.ts`
- Update `updateLead` mutation to return the lead ID and detect stage changes so the caller can trigger notifications

### Email Format
```
Subject: [Rebar.shop] Lead Update: {lead_title}

{actor_name} {action_description}

{note_text (if applicable, text only, no attachment URLs)}

View record: https://cusum-brain-flow.lovable.app/sales/pipeline?lead={lead_id}
```

### Vendor Mention Detection
The note body is checked for `@VendorName` patterns. If a vendor assignee's `full_name` appears after an `@` symbol in the note, they receive the email. Otherwise they are skipped.

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | NEW — email notification logic |
| `src/components/sales/SalesLeadChatter.tsx` | Call edge function after note creation |
| `src/pages/sales/SalesPipeline.tsx` | Call edge function after stage change |

