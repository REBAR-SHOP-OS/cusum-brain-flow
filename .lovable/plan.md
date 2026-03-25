

## Send Email to Customer on Note Logged

### Problem
When a user logs a note in the Sales Lead drawer, the `notify-lead-assignees` edge function sends notification emails only to internal assignees and @mentioned vendors. It does NOT send an email to the **customer** (the lead's `contact_email`). The user expects the customer to also receive an email from `ai@rebar.shop`.

### Root Cause
The edge function queries `sales_leads` for only the `title` field and builds recipients exclusively from `sales_lead_assignees`. The lead's `contact_email` is never fetched or used.

### Fix

**File: `supabase/functions/notify-lead-assignees/index.ts`**

1. Expand the lead query to also select `contact_email` and `contact_name`:
   ```typescript
   .select("title, contact_email, contact_name")
   ```

2. After building the assignee recipient list, add the customer as a recipient if `contact_email` exists and is not already in the list:
   ```typescript
   if (lead.contact_email) {
     const alreadyIncluded = recipients.some(r => r.email.toLowerCase() === lead.contact_email.toLowerCase());
     if (!alreadyIncluded) {
       recipients.push({ email: lead.contact_email, full_name: lead.contact_name || lead.contact_email });
     }
   }
   ```

3. Differentiate the email body for the customer vs internal assignees — the customer should receive a professional message without internal details like "View record" links. Build a separate `customerEmailBody` that contains only the note text and a professional closing, while keeping the current `emailBody` (with record link) for internal recipients.

4. In the send loop, check if the recipient is the customer and use the appropriate email body.

### Deployment
After editing the edge function, redeploy `notify-lead-assignees`.

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Add customer (`contact_email`) as email recipient with professional email body |

