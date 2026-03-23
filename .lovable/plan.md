

## Fix: Add `send_email` Tool to Admin-Chat (Text Vizzy)

### Root Cause

Vizzy said "I can't send emails directly" because **admin-chat has no `send_email` function-calling tool registered**. The system prompt tells her she can send emails, but the OpenAI tools array has no such tool — so she literally cannot call it. The tool exists in `agentTools.ts` (for sub-agents like sales/accounting) and in `vizzy-erp-action` (for voice mode), but was never wired into admin-chat's own tool definitions or executor.

### Fix

**File: `supabase/functions/admin-chat/index.ts`**

Two additions:

1. **Tool definition** — Add a `send_email` function tool to the tools array (alongside existing tools like `rc_send_sms`, `rc_make_call`):
   ```
   name: "send_email"
   parameters: to (required), subject (required), body (required), threadId (optional), replyToMessageId (optional)
   ```

2. **Tool executor** — Add a `case "send_email"` block in the tool execution switch that calls `gmail-send` edge function (same pattern used in `agentToolExecutor.ts`):
   - Calls `supabase.functions.invoke("gmail-send", { body: { to, subject, body, threadId, replyToMessageId } })`
   - Returns success with messageId/threadId
   - Add to confirmation-required list so Vizzy shows "Send email to X?" before executing

3. **Confirmation description** — Add `send_email` to the `getConfirmationDescription` function: `Send email to ${args.to}: "${args.subject}"`

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/admin-chat/index.ts` | Add `send_email` tool definition, executor case, and confirmation description |

### What This Fixes
- Text Vizzy will be able to actually send emails when the CEO says "send"
- No more "copy and paste it yourself" responses
- Same email sending capability that voice Vizzy and sub-agents already have

