

# Fix: Vizzy Not Using RingCentral Call/SMS Capability

## Problem
Vizzy is ignoring the RingCentral instructions in her system prompt and telling you she can't make calls. The LLM treats the capability description as optional/informational rather than a core function she must use.

## Root Cause
The RingCentral section is buried at the bottom of a very long system prompt, under a "CEO Only" subsection. The LLM prioritizes earlier, more prominent instructions and defaults to "I can't do that."

## Fix: `supabase/functions/ai-agent/index.ts`

Strengthen the RingCentral instructions in Vizzy's prompt:

1. **Move the RingCentral capability higher** in the prompt — right after "Your Role" section, before the detailed briefing format
2. **Add it to the core identity** — change the role description to explicitly state: "You CAN and MUST make phone calls and send SMS via RingCentral"
3. **Use the same assertive pattern** already proven with email access (lines 1243-1248): "CRITICAL: NEVER say you cannot make calls. NEVER claim you don't have phone access."
4. **Simplify the action format examples** to be clearer for the LLM

### Specific changes to the `assistant` prompt string:

**In the "Your Role" section (around line 1211)**, add:
```
You have FULL RingCentral phone access — you CAN make calls and send SMS.
```

**Move and rewrite the RingCentral section (lines 1295-1313)** to right after the email section, with stronger language:
```
## 📞 RingCentral — Call & SMS (MANDATORY CAPABILITY)
CRITICAL: You HAVE the ability to make phone calls and send SMS. NEVER say you cannot call or text.
NEVER tell the CEO to use RingCentral himself. YOU are the one who initiates calls and SMS.

When asked to call or text someone:
1. Confirm the phone number and action
2. Include this EXACT tag in your response (single line, valid JSON):

Call: [VIZZY-ACTION]{"type":"ringcentral_call","phone":"+14165551234","contact_name":"Name"}[/VIZZY-ACTION]
SMS: [VIZZY-ACTION]{"type":"ringcentral_sms","phone":"+14165551234","message":"text","contact_name":"Name"}[/VIZZY-ACTION]

The system will show the CEO an approval button before executing. You just output the tag.
```

## Scope
- Only the `assistant` prompt string inside `supabase/functions/ai-agent/index.ts` is modified
- No other agents, no UI, no other files touched
