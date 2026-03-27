

# Fix: `authHeader is not defined` in Blitz Sales Agent

## Root Cause

In `supabase/functions/ai-agent/index.ts` line 434-435, the handler destructures:
```ts
handleRequest(req, async ({ body, userId, serviceClient, userClient }) => {
```

But `req` (the original Request object containing the Authorization header) is **never captured inside the callback**. On line 1126, the undefined `authHeader` is passed to `executeToolCall`, which uses it to forward the user's JWT to downstream edge functions (`quote-engine`, `ai-estimate`, `gmail-send`, etc.).

Since `authHeader` is `undefined`, every tool call that hits another edge function fails with a runtime error.

## Fix

**File:** `supabase/functions/ai-agent/index.ts`

**Line 435** — Add `req` to the destructured context and extract the auth header:

```ts
// Before:
handleRequest(req, async ({ body, userId, serviceClient, userClient }) => {

// After:
handleRequest(req, async ({ req: originalReq, body, userId, serviceClient, userClient }) => {
    const authHeader = originalReq.headers.get("Authorization") || "";
```

This single 2-line change fixes all tool calls (quote generation, email sending, QB sync, etc.) because `authHeader` will now contain the user's valid `Bearer <jwt>` token.

## Files Changed
- `supabase/functions/ai-agent/index.ts` — extract `authHeader` from request headers (line 435)

