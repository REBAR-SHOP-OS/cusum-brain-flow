

# Split Vizzy Call Handling: Personal Assistant (Ext 101) vs Sales Agent (All Others)

## The Key Distinction

- **Extension 101 (Sattar's direct line):** Vizzy answers as a personal assistant — "Sattar is busy right now, can I help? If not, I'll make sure he knows you called." Warm, gatekeeper behavior. Current behavior stays mostly the same.
- **All other company extensions (missed calls, after-hours, weekends):** Vizzy answers as a trained sales agent — answers product questions, provides ballpark pricing, captures RFQs, offers to connect to team members. Revenue-generating.

## File Changes

### 1. `supabase/functions/vizzy-call-receptionist/index.ts` — Route by Extension

Accept a new `targetExtension` parameter. Based on whether it's `"101"` or not, return a completely different prompt:

**Extension 101 (personal assistant):** Keep the existing gatekeeper prompt almost unchanged — "Sattar is busy, I'll pass along the message." No pricing, no sales. Just take a message and offer to help if possible.

**All other extensions (sales agent):** New prompt with:
- Full product catalog (10M-35M rebar, copied from `sales-concierge`)
- Bending types and surcharges
- Volume discount tiers
- AI-driven sales questions ("What's your project timeline?", "How many tonnes are you looking at?")
- Team directory for diversion (Neel = Sales, Saurabh = Operations, Sattar = Owner)
- After-hours awareness (Mon-Fri 8-5 ET)
- Confidentiality rules (CAN discuss catalog/pricing, CANNOT discuss specific orders/invoices)

The function already fetches contact/lead/delivery context from DB — this stays the same for both modes.

### 2. `src/components/vizzy/VizzyCallHandler.tsx` — Pass Extension + Handle All Extensions

Currently hardcoded to `TARGET_EXTENSION = "101"` only. Changes:
- Remove the single-extension filter — listen for calls on ALL extensions
- Pass the called extension number to `vizzy-call-receptionist` so it returns the right prompt
- Store which mode was used (personal vs sales) in `callerInfoRef`
- Post-call: if sales mode and RFQ captured, create approval notification
- Post-call: if callback requested for a specific person, create a task for them

### 3. `supabase/functions/summarize-call/index.ts` — Extract Sales Intelligence

Add to the JSON extraction schema:
- `rfq_details`: object with `bar_sizes`, `quantities`, `project_type`, `timeline` if caller requested a quote
- `callback_requested`: string (team member name) if caller asked to speak with someone specific
- `lead_info`: object with `name`, `company`, `phone`, `project_description`
- `call_mode`: "personal_assistant" or "sales_agent" (passed from caller)

### 4. `supabase/functions/_shared/vizzyIdentity.ts` — Update CAN DO List

Add line: "Answer company-wide inbound calls — personal assistant on ext 101, smart sales agent on all other lines. Captures RFQs and flags leads with CEO approval."

## Call Flow

```text
Inbound call arrives
  │
  ├── Extension 101 (Sattar's line)?
  │   └── PERSONAL ASSISTANT MODE
  │       "Sattar is busy — can I help? If not, I'll pass along the message."
  │       → Summarize → notify CEO
  │
  └── Any other extension (or missed/after-hours)?
      └── SALES AGENT MODE
          "Hi, this is Vizzy at Rebar Shop! How can I help?"
          ├── Product questions → answer with catalog knowledge
          ├── Pricing → ballpark estimates
          ├── RFQ → capture details, "We'll have a quote ready for you"
          ├── Wants Neel/Saurabh → "I'll have them call you back"
          └── Post-call:
              ├── RFQ? → Notification: "Approve to create lead?"
              ├── Callback? → Task for team member
              └── Hot lead? → Priority flag to CEO
```

## Impact
- 4 files changed
- Vizzy handles ALL company calls, not just ext 101
- Two distinct personalities: gatekeeper vs sales agent
- RFQ capture and lead creation require CEO approval
- No database or auth changes

