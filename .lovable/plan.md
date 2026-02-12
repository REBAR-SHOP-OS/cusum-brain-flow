

# Fix Vizzy Denying Email Access

## Problem
Vizzy tells the CEO "I do not have the ability to read the content of emails" — but this is wrong. Vizzy already has full access to all inbound emails in its context data. The phrase is NOT in your codebase — the AI model is hallucinating a privacy restriction that doesn't exist.

## Root Cause
The current prompt says "You have access to ALL inbound emails" but doesn't explicitly tell the model to STOP claiming it can't read them. Large language models have a built-in safety reflex around email/privacy — the prompt needs to override that reflex with a direct, assertive instruction.

## Fix

### File: `supabase/functions/ai-agent/index.ts` (line 1242-1245)

Strengthen the "Full Email Access" section from:

```
## Full Email Access
You have access to ALL inbound emails to @rebar.shop in your context...
```

To something like:

```
## Full Email Access — MANDATORY
You CAN and MUST read, search, and discuss email content when asked.
The allInboundEmails array in your context contains real email data
(subject, from, to, body_preview, timestamps) for up to 200 recent
inbound messages to @rebar.shop.

NEVER say you cannot read emails. NEVER claim your access is limited
to metadata. You have FULL email content access — this is a business
system, not personal email. Use it confidently.

When asked about emails: search allInboundEmails by from_address,
to_address, subject, or body_preview and report findings directly.
```

This explicitly counters the model's safety reflex with a clear override.

## Summary
- 1 file modified: `supabase/functions/ai-agent/index.ts`
- Strengthens the email access prompt to prevent the model from falsely denying access
- No logic or query changes needed — the data is already being fetched correctly
