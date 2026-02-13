
# Route Emails to Existing Projects and Notify Task Owner

## What Changes

When the RFQ scanner processes an email that matches an **existing active lead or project** (by customer, sender email, or project/subject keywords), instead of creating a **duplicate lead**, the system will:

1. **Attach the email as a timeline activity** to the matching existing lead
2. **Send a notification** to the lead's assigned person (task owner) about the new correspondence
3. Only create a **new lead** if no match is found (current behavior preserved)

## Matching Logic (in priority order)

```text
1. CUSTOMER MATCH: Email sender's company/email matches a customer 
   linked to an active lead (stage not in archived/closed/loss)
   --> Route to the most recently updated lead for that customer

2. PROJECT NAME MATCH: Email subject or body contains keywords 
   matching an existing project name or lead title
   --> Route to that lead

3. NO MATCH: Create a new lead (current behavior, unchanged)
```

## What Happens on Match

- A new `lead_activities` entry is added to the existing lead's timeline:
  - Type: "email"  
  - Title: "Follow-up email received"
  - Description: includes sender, subject, body snippet, and any attachments
- Attachments are downloaded and stored under the existing lead's ID
- A notification is created for the lead's assigned person (looked up from the lead's `notes` field "Assigned: Name" pattern)
- The email is marked as processed (via `source_email_id`) so it won't be re-scanned

## Technical Details

### File Modified

**`supabase/functions/process-rfq-emails/index.ts`**

Add a new matching step **before** the AI analysis + lead creation block (around line 491):

1. **Sender email lookup**: Query active leads where the customer's contact email matches the sender
2. **Customer match**: If the email's sender company fuzzy-matches a customer on an active lead, route there
3. **Subject keyword match**: Tokenize existing lead titles and project names; if the incoming email subject shares significant tokens, match

When a match is found:
- Skip AI analysis (not needed -- we know where it goes)
- Insert a `lead_activities` row on the matched lead
- Download any attachments to the matched lead's storage folder
- Look up the assigned person from the lead's `notes` field
- Resolve assigned person's `user_id` via the `profiles` table (fuzzy name match on `full_name`)
- Insert a `notifications` row for that user with `link_to: /pipeline` so they can jump straight to the lead
- Mark email as processed by inserting a `source_email_id` entry so it won't create a duplicate on re-scan

### New Helper Function

```text
findMatchingLead(senderEmail, senderCompany, subject, activeLeads, customers)
  --> returns { leadId, leadTitle, assignedTo } | null
```

### Notification Format

| Field | Value |
|-------|-------|
| type | "notification" |
| title | "New email on lead: S01392, RE: ERIC ARSENAULT" |
| description | "Email from eric@example.com — Subject: RE: delivery schedule" |
| priority | "normal" |
| link_to | "/pipeline" |
| agent_name | "Blitz" |

### No Database Schema Changes Required

All existing tables (`leads`, `lead_activities`, `notifications`, `profiles`, `customers`, `contacts`) already have the necessary columns.
