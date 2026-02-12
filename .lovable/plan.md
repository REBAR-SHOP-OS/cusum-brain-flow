

# Give Penny Calling Powers for Collections & Follow-ups

## What We're Building
Penny (your Accounting agent) will be able to make phone calls directly from the browser for AR collections and follow-ups. When you ask Penny to call a customer about an overdue invoice, she'll initiate a WebRTC call right from the accounting workspace -- same browser-calling tech we just built for Vizzy.

## How It Works
1. When you open the Accounting workspace, the WebPhone registers in the background
2. You tell Penny "Call ABC Corp about their overdue invoice" 
3. Penny looks up the contact's phone number and shows a click-to-call button
4. You click it, the call connects through your browser mic/speaker
5. Penny tracks the call as a collection activity

## Implementation Steps

### 1. Add WebPhone to AccountingWorkspace
- Import and initialize `useWebPhone` in `AccountingWorkspace.tsx`
- Pass the WebPhone actions down to `AccountingAgent` as props
- WebPhone registers in the background when the workspace loads

### 2. Add Call UI to AccountingAgent
- Add a "Call" action button that Penny can surface when discussing overdue invoices
- When Penny's response mentions a contact with a phone number, render a clickable call button inline
- Show call status (dialing, on call) and a hang-up button in the Penny header area
- Parse Penny's responses for `[CALL]` action tags (similar to Vizzy's `[VIZZY-ACTION]` pattern)

### 3. Enhance Penny's System Prompt for Collections
- Update the `ai-agent` edge function's accounting prompt to include instructions for collections calling
- Tell Penny to output a structured action tag like `[PENNY-CALL]{"phone":"+1234567890","contact_name":"John","reason":"INV-1234 overdue"}[/PENNY-CALL]` when the user asks her to call someone
- Include the overdue invoice context so Penny can reference specific amounts and invoice numbers during the call suggestion

### 4. Call Action Parser in AccountingAgent
- After receiving Penny's response, parse for `[PENNY-CALL]` tags
- Render a "Call Now" button card with contact name, phone, and reason
- On click, use `webPhoneActions.call(phone, contactName)` to initiate the WebRTC call
- Log the collection call as an activity event

### 5. Post-Call Collection Logging
- After a call ends, prompt to log the outcome (promised payment date, left voicemail, no answer, etc.)
- Save to `activity_events` table as a collection follow-up event

## Technical Details

**Files to modify:**
- `src/pages/AccountingWorkspace.tsx` -- initialize `useWebPhone`, pass to AccountingAgent
- `src/components/accounting/AccountingAgent.tsx` -- accept WebPhone props, parse call actions, render call UI, show call status
- `supabase/functions/ai-agent/index.ts` -- update Penny's system prompt with collections calling instructions and action tag format

**Files to create:**
- `src/components/accounting/PennyCallCard.tsx` -- reusable call action card component (shows contact, reason, "Call Now" button, call status)

**Existing patterns reused:**
- `useWebPhone` hook (already built for Vizzy)
- `ringcentral-sip-provision` edge function (already deployed)
- Action tag parsing pattern (from Vizzy's `[VIZZY-ACTION]` system)

