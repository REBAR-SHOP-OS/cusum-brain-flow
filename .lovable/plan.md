
# Fix: Draft-Only Mode Blocking Vizzy's Calls

## Root Cause Found

The `comms_config` table has `no_act_global: true`, which injects this text into Vizzy's prompt:

> "You are in TRACKING/DRAFT-ONLY mode. You CANNOT send emails, messages, or perform any external actions."

This contradicts the RingCentral instructions and the model obeys the "CANNOT perform external actions" rule, refusing all calls.

The fix is straightforward: exempt Vizzy (the assistant agent) from the draft-only restriction, since she is the one agent that NEEDS to perform external actions (calls, SMS) on behalf of the CEO.

## Fix: `supabase/functions/ai-agent/index.ts`

**Around line 2871-2873**, modify the `DRAFT_ONLY_BLOCK` logic to skip injection when the agent is `assistant`:

```typescript
// Current (broken):
const DRAFT_ONLY_BLOCK = stripSendCapabilities
  ? `\n\n## DRAFT-ONLY MODE ACTIVE\n...You CANNOT...trigger external actions...`
  : "";

// Fixed:
const DRAFT_ONLY_BLOCK = (stripSendCapabilities && agent !== "assistant")
  ? `\n\n## DRAFT-ONLY MODE ACTIVE\n...You CANNOT...trigger external actions...`
  : "";
```

This is a one-line change. It keeps draft-only mode active for all other agents (sales, accounting, etc.) but allows Vizzy to retain her call/SMS capabilities.

## Why Previous Fixes Failed

The model upgrade (gemini-2.5-pro) and prompt rewrites were correct, but the draft-only block injected AFTER those instructions was overriding them. The stronger model actually made this worse because gemini-2.5-pro follows ALL instructions more carefully -- including the "CANNOT perform external actions" one.

## Scope
- One line change in `supabase/functions/ai-agent/index.ts` (line ~2871)
- No other files modified
