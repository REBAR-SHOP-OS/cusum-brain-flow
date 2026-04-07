

# Upgrade Vizzy Call Receptionist to Smart Sales Agent

## What's Changing

Currently, Vizzy answers calls as a passive gatekeeper — takes a message and says "Sattar will call you back." The CEO wants Vizzy to act as a **smart sales agent** on missed calls, after-hours, and weekends: answer questions about products/pricing using business knowledge, capture RFQs, offer to connect callers to specific team members, and close what she can — all with CEO approval for write actions.

## Changes

### 1. `supabase/functions/vizzy-call-receptionist/index.ts` — Full Rewrite of Instructions

Replace the passive gatekeeper prompt with a smart sales agent prompt that includes:

**Product Knowledge** (from sales-concierge catalog):
- Full rebar product catalog (10M-35M), weights, grades, price ranges
- Bending types and surcharges (straight, L-shape, U-shape, custom)
- Volume discount tiers (5t/10t/20t)

**Sales Capabilities**:
- Answer product questions confidently (sizes, specs, pricing ballparks)
- Capture caller details for RFQ (name, company, project, sizes, quantities)
- Provide ballpark estimates using the same logic as sales-concierge
- Flag hot leads with project details

**Team Directory for Call Diversion**:
- If caller asks for a specific person (Neel, Saurabh, Sattar, etc.), offer to transfer or have them call back
- Include extension/role mapping so Vizzy can say "I'll have Neel call you back — he handles [role]"

**After-Hours Awareness**:
- Detect business hours (Mon-Fri 8AM-5PM ET)
- During hours: "Let me connect you" / "They're on another line, I'll have them call back"
- After hours/weekends: "We're closed right now but I can absolutely help you with pricing and get your request queued for first thing Monday morning"

**Approval Protocol** (via post-call processing):
- Captured RFQs create a draft lead + notification for CEO approval
- Team member callbacks create a task for the requested person
- Sales opportunities flagged with priority

**Confidentiality (relaxed for sales)**:
- CAN discuss: product catalog, general pricing, capabilities, lead times (general)
- CANNOT discuss: specific customer orders, exact invoice amounts, internal operations
- CANNOT confirm: specific delivery dates for existing orders

### 2. `supabase/functions/vizzy-call-receptionist/index.ts` — Enrich ERP Context

Add to the data fetch:
- Recent products/services info (hardcoded catalog, same as sales-concierge)
- Team directory with roles for diversion logic
- Business hours detection (is it after hours right now?)

### 3. `supabase/functions/summarize-call/index.ts` — Upgrade Post-Call Processing

Update the system prompt to also extract:
- `rfq_details`: If caller requested a quote (bar sizes, quantities, project type)
- `callback_requested`: If caller asked to speak with a specific person (name)
- `lead_info`: Name, company, phone, project description

These get passed back to `VizzyCallHandler` which creates appropriate notifications/tasks.

### 4. `src/components/vizzy/VizzyCallHandler.tsx` — Handle RFQ & Callback Actions

After call summary, if `rfq_details` exists:
- Create a notification: "📞 Vizzy captured an RFQ from [caller] — [project details]. Approve to create lead?"
- Include the details in metadata for CEO to act on

If `callback_requested` exists:
- Create a task for the requested team member: "Call back [caller name] at [number] — [reason]"

### 5. `supabase/functions/_shared/vizzyIdentity.ts` — Update CAN DO List

Add: "Answer inbound sales calls as a knowledgeable sales agent — provide product info, ballpark pricing, and capture RFQs with CEO approval"

## The New Call Flow

```text
Caller → Vizzy picks up
  ├── "Hi, this is Vizzy at Rebar Shop!"
  ├── Identifies caller from contacts DB
  │
  ├── SALES INQUIRY:
  │   ├── Answers product questions (sizes, specs, pricing)
  │   ├── Provides ballpark estimates
  │   ├── Captures RFQ details (project, quantities, timeline)
  │   └── "I've got all the details — we'll have a formal quote ready for you."
  │
  ├── WANTS SPECIFIC PERSON:
  │   ├── During hours: "Let me see if [name] is available..."
  │   ├── After hours: "The team is out for the day, but I'll have [name] call you first thing tomorrow."
  │   └── Creates callback task for that person
  │
  ├── EXISTING ORDER QUESTION:
  │   └── "I'll have the team look into that and get back to you with the details."
  │
  └── POST-CALL:
      ├── Summarize → vizzy_memory
      ├── RFQ captured? → Notification with approval request
      ├── Callback needed? → Task for team member
      └── Hot lead? → Priority notification to CEO
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/vizzy-call-receptionist/index.ts` | Rewrite prompt: passive gatekeeper → smart sales agent with product knowledge, team directory, hours awareness (~120 lines replaced) |
| `supabase/functions/summarize-call/index.ts` | Extract RFQ details, callback requests, lead info from transcripts (~15 lines updated) |
| `src/components/vizzy/VizzyCallHandler.tsx` | Create tasks/notifications for RFQs and callback requests (~30 lines added) |
| `supabase/functions/_shared/vizzyIdentity.ts` | Update CAN DO list (~2 lines) |

## Impact
- 4 files changed
- Vizzy becomes a revenue-generating phone agent, not just a message-taker
- All write actions (lead creation, task assignment, emails) still require CEO approval via notifications
- No database or auth changes needed

