

## Plan: Make Blitz Work Equally for All Sales Users + Smarter Quoting

### Problem
The Blitz sales prompt (line 3-4 of `sales.ts`) is hardcoded as "Neel's AI accountability partner." When Saurabh or Sattar uses Blitz, the agent still refers to itself as Neel's assistant, creating confusion and potentially refusing to act on their behalf.

Additionally, Blitz should be smarter about building formal quotes from any casual input (e.g., "create quotation for 100 15mm rebar") by using the price list from Brain knowledge and the `generate_sales_quote` tool — without asking unnecessary questions when reasonable defaults exist.

### Changes

**File: `supabase/functions/_shared/agents/sales.ts`**

1. **Make Blitz user-aware** — Replace the hardcoded "Neel's AI accountability partner" identity with a dynamic instruction:
   - "You serve whichever sales team member is currently chatting with you. Check the `Current User` block in the system prompt for their name and email."
   - Keep the team directory but remove the assumption that Neel is always the user.

2. **Smarter quoting behavior** — Add explicit instructions:
   - When a user gives a simple request like "quote for 100 15mm rebar", use reasonable defaults (straight bars, standard 20ft length, no delivery, no coating) and call `generate_sales_quote` with `action: "quote"` immediately.
   - Only use `action: "validate"` when truly ambiguous (e.g., no bar size, no quantity at all).
   - After generating the quote, offer to send it to a customer via email from the chat.

3. **Allow sending quotes from chat** — Add instruction that after a quote is generated, Blitz should offer to format it as a professional email and send it using the `send_email` tool (if available) or draft it for approval.

**File: `supabase/functions/_shared/agentTools.ts`**

4. **Give Blitz access to `send_email`** — Line 37: Add `"sales"` to the agent list that gets the `send_email` tool, so Blitz can send quotes to customers directly from chat.

### Technical Details

- The `Current User` block is already injected at line 936 of `ai-agent/index.ts`: `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`
- Blitz already has the `generate_sales_quote` tool (line 499 of agentTools.ts)
- The `send_email` tool is currently only available to `accounting`, `commander`, and `email` agents (line 37)
- No database changes needed — this is purely prompt + tool access adjustment

### Files to modify
- `supabase/functions/_shared/agents/sales.ts` — Rewrite Blitz prompt to be user-agnostic + smarter quoting defaults
- `supabase/functions/_shared/agentTools.ts` — Add `"sales"` to `send_email` tool access

