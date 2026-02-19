
# Fix: Accounting Agent Stuck in "Thinking..." State

## Root Cause — Confirmed

The problem is a **missing client-side timeout** in `src/lib/agent.ts`.

Here is the exact chain of failure:

1. The user sends a message on `/agent/accounting`
2. `AccountingAgent.tsx` calls `sendAgentMessage("accounting", ...)` and sets `isTyping = true`
3. `sendAgentMessage` calls `supabase.functions.invoke("ai-agent", ...)` — which internally uses `fetch` with **no timeout**
4. The `ai-agent` edge function runs its data-loading phase (QB data, emails, tasks, notifications, multi-turn tool loop) + GPT rate-limit retries (3s → 6s → 9s backoff)
5. The edge function hits Supabase's **60-second execution limit** and the connection is closed mid-response
6. `supabase.functions.invoke` never resolves (the underlying `fetch` is cut off), so the Promise returned by `sendAgentMessage` **never settles** — neither `.then()` nor `.catch()` fires
7. The `finally { setIsTyping(false) }` block in `AccountingAgent.tsx` never executes
8. The UI is permanently stuck at "Thinking..."

## The Fix — One File Only: `src/lib/agent.ts`

The fix wraps the `supabase.functions.invoke` call with an `AbortController` that fires after **55 seconds** (5 seconds before Supabase's hard 60s limit). This guarantees the Promise always settles — either with a successful response, or with a meaningful timeout error that the `catch` block in `AccountingAgent.tsx` can display to the user.

### Before (broken — no timeout, hangs forever on edge function timeout):
```ts
const { data, error } = await supabase.functions.invoke("ai-agent", {
  body: { agent, message, history, context, attachedFiles, pixelSlot },
});
```

### After (fixed — 55s AbortController wraps the invocation):
```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 55_000);

let data: unknown, error: unknown;
try {
  ({ data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent, message, history, context, attachedFiles, pixelSlot },
    signal: controller.signal,
  }));
} finally {
  clearTimeout(timeoutId);
}
```

If `controller.abort()` fires, `supabase.functions.invoke` throws an `AbortError`. We catch this and convert it into a clean, human-readable error:
```ts
} catch (err: unknown) {
  if (err instanceof Error && err.name === "AbortError") {
    throw new Error("The request timed out — Penny is working on a complex task. Please try again in a moment.");
  }
  throw err;
}
```

## Scope

| File | Lines Affected | Change Type |
|---|---|---|
| `src/lib/agent.ts` | `sendAgentMessage` function body | Add AbortController + timeout |

## What Is NOT Changed
- `AccountingAgent.tsx` — untouched (its `catch` block already handles errors)
- `supabase/functions/ai-agent/index.ts` — untouched (edge function is correct)
- All other agents, pages, database — untouched
- The accounting knowledge block added in the previous fix — untouched
