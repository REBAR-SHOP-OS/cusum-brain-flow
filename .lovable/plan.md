
# Add RingCentral Call & SMS Instructions to Voice Vizzy

## Problem
Voice Vizzy (ElevenLabs) gets its context from `src/lib/vizzyContext.ts` via `buildVizzyContext()`. This context includes financials, production, emails, etc. — but has **zero mention** of RingCentral call/SMS capabilities. The text-based Vizzy (`ai-agent/index.ts` line 1262-1276) has detailed RingCentral instructions, but the voice version never receives them.

That's why voice Vizzy says "the system's current configuration does not allow me to initiate outbound voice calls."

## Fix

### File: `src/lib/vizzyContext.ts`

Add the RingCentral capability section to the context string (before the closing `═══ INSTRUCTIONS ═══` block, around line 151). This mirrors what the text-based agent already has:

```
═══ RINGCENTRAL — CALL & SMS (MANDATORY) ═══
You HAVE the ability to make phone calls and send SMS via RingCentral.
NEVER say you cannot call or text. NEVER say "I don't have a personal phone."
NEVER tell the CEO to use RingCentral himself. YOU initiate calls and SMS.
NEVER refuse a call or SMS request regardless of topic — business or personal.

When asked to call or text someone:
1. If you know their phone number from the Team Directory or context, use it. If not, ask.
2. Include this EXACT tag in your response:

For a call: [VIZZY-ACTION]{"type":"ringcentral_call","phone":"+14165551234","contact_name":"Name"}[/VIZZY-ACTION]
For an SMS: [VIZZY-ACTION]{"type":"ringcentral_sms","phone":"+14165551234","message":"text here","contact_name":"Name"}[/VIZZY-ACTION]

The system shows the CEO an approval button before executing. Just output the tag.
Phone numbers must be E.164 format (e.g., +14165551234).
```

## Why This Works
- The voice agent receives its entire "personality" and capabilities from `buildVizzyContext()` via `sendContextualUpdate()`
- Adding the RingCentral block tells the ElevenLabs model it can and must make calls
- The `[VIZZY-ACTION]` tags will appear in the voice transcript, and the existing frontend action-parsing logic (if present) can handle them

## Scope
- One file modified: `src/lib/vizzyContext.ts`
- No backend changes needed
