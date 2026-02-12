

# Give Vizzy Full Access to Emails, Live QuickBooks, and Employee Call Notes

## What Changes

### 1. All Inbound @rebar.shop Emails for Vizzy
Currently Vizzy only sees the 15 most recent communications regardless of direction. We will expand this so Vizzy gets ALL inbound emails to any @rebar.shop address (up to 200), giving her full visibility into every conversation coming into the company.

### 2. Live QuickBooks Data (Not Cached Snapshot)
Currently only the Accounting agent (Penny) gets live QuickBooks API data. Vizzy only sees the `accounting_mirror` table which may be stale. We will give the `assistant` agent the same live QuickBooks integration that Penny has -- real-time customers, invoices, payments, and company info directly from the QuickBooks API.

### 3. Employee Performance via "Notes of your call with Rebar Dot Shop" Emails
When the CEO asks about employee performance, Vizzy will have access to all "Notes of your call with Rebar Dot Shop" emails. These are RingCentral call summary emails that show which employee spoke with which customer. We will:
- Fetch these specific emails as a dedicated context block
- Map them to employees by matching the `from_address` or `to_address` against the team directory
- Include subject, preview, timestamp, and the employee involved
- Update Vizzy's system prompt to instruct her to use this data for performance analysis

### 4. Updated Vizzy System Prompt
Add instructions telling Vizzy to:
- Use the full email inbox to answer questions about customer communications
- Use live QuickBooks data for financial questions (not cached)
- Analyze "Notes of your call" emails when asked about employee performance or customer interactions

## Technical Details

### File: `supabase/functions/ai-agent/index.ts`

**A. Expand email context for assistant agent (inside `fetchContext`, within the `if (agent === "assistant")` block around line 1942):**

Add a query for all inbound @rebar.shop emails (up to 200):
```typescript
// All inbound emails to rebar.shop
const { data: allInboundEmails } = await supabase
  .from("communications")
  .select("id, subject, from_address, to_address, body_preview, status, source, received_at, direction")
  .ilike("to_address", "%@rebar.shop%")
  .order("received_at", { ascending: false })
  .limit(200);
context.allInboundEmails = allInboundEmails;
```

Add a dedicated query for "Notes of your call" emails:
```typescript
// Employee call notes for performance tracking
const { data: callNotes } = await supabase
  .from("communications")
  .select("id, subject, from_address, to_address, body_preview, received_at")
  .ilike("subject", "%Notes of your call with Rebar%")
  .order("received_at", { ascending: false })
  .limit(100);
context.employeeCallNotes = callNotes;
```

**B. Add live QuickBooks data for assistant agent (inside the same `if (agent === "assistant")` block):**

Copy the same QuickBooks live API integration that exists for the `accounting` agent (lines 1758-1888) into the `assistant` block. This fetches customers, invoices, payments, and company info directly from the QuickBooks API using the stored OAuth tokens.

**C. Update Vizzy's system prompt (line 1211-1275):**

Add these sections to the assistant prompt:

```
## 📧 Full Email Access
You have access to ALL inbound emails to @rebar.shop in your context (allInboundEmails).
Use this to answer questions about customer communications, response times, and team activity.

## 💼 Live QuickBooks Access
You have LIVE QuickBooks data (not cached). Use qbCustomers, qbInvoices, qbPayments for real-time financial answers.

## 📞 Employee Performance — Call Notes
When asked about employee performance or customer interactions, check employeeCallNotes in context.
These are emails with subject "Notes of your call with Rebar Dot Shop" — each one represents a recorded call between an employee and a customer.
- Match the to_address or from_address to team members to identify who made the call
- Count calls per employee to measure activity
- Review body_preview for call quality and topics discussed
- Compare call frequency across team members
```

### Summary of Changes
- **1 file modified**: `supabase/functions/ai-agent/index.ts`
  - ~30 lines added to `fetchContext` for expanded email + call notes queries
  - ~80 lines added to `fetchContext` for live QuickBooks API calls (mirrored from accounting agent)
  - ~20 lines added to Vizzy's system prompt for new capabilities

