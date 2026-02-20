
# Full App Audit — Findings & Fix Plan

## What "Lost the Brain" Means

Looking at the logs and code together, the agents are working but with reduced intelligence because:

1. **GPT-4o is still being selected for `accounting`, `legal`, and `empire` agents** — then hitting 429 (rate limit) and falling back to `gemini-2.5-flash`. This means these complex agents get the fast/cheap Gemini model instead of the smart one, making them seem "dumb."

2. **The `admin-chat` (Vizzy at `/chat`) is returning its own 429 errors** at the edge function level — this is a separate rate-limiter built inside `admin-chat` itself that hasn't been tuned for Gemini's higher throughput.

3. **The tool execution loop follow-up calls have NO fallback** — when `gpt-4o` fails mid-tool-loop, the second AI call also fails silently, cutting agents off mid-thought.

4. **`maxTokens: 2000` for the default Gemini path is too small** — agents trying to write detailed reports hit the token ceiling and produce truncated, low-quality replies.

---

## Issue Breakdown

### Issue 1 — Wrong model selected for complex agents (ROOT CAUSE of "lost brain")

In `aiRouter.ts`, the `selectModel` function routes `accounting`, `legal`, and `empire` to `gpt-4o`:

```typescript
if (["accounting", "legal", "empire"].includes(agent) || ...) {
  return { provider: "gpt", model: "gpt-4o", ... };
}
```

The `callAI` fallback works, but only if the error is a 429 **AND** the `fallback` option is passed. Looking at the tool-loop follow-up call (lines 273-281 of `ai-agent/index.ts`), it does NOT pass the `fallback` option:

```typescript
// Follow-up AI call — NO FALLBACK OPTION
aiResult = await callAI({
  provider: modelConfig.provider,
  model: modelConfig.model,
  ...
  // ❌ fallback: missing here
});
```

This means the first call falls back correctly, but any tool calls and follow-ups crash silently.

**Fix**: Route `accounting`, `legal`, `empire`, and `commander` to `gemini-2.5-pro` directly (since GPT quota is exhausted) and add the fallback to the tool loop's follow-up call.

---

### Issue 2 — Default `maxTokens: 2000` is too low for Gemini responses

With Gemini as the primary model, many agents try to produce detailed reports but get cut off at 2000 tokens (~1500 words). This causes:
- Incomplete daily briefings (Penny stops mid-report)
- Truncated pipeline analyses (Blitz cuts off mid-table)
- Short, surface-level responses that feel "brainless"

**Fix**: Increase default `maxTokens` to `4000` for the Gemini default path.

---

### Issue 3 — `admin-chat` has a built-in rate limiter blocking Gemini calls

The analytics logs show `admin-chat` returning 429s to the browser. This is an internal rate limiter in `admin-chat/index.ts` that throttles requests per user. With Gemini being faster and users sending more requests, the limiter triggers prematurely.

**Fix**: Review and increase the rate limit window in `admin-chat/index.ts`.

---

### Issue 4 — Tool loop follow-up has no fallback

In `ai-agent/index.ts` line 273, the follow-up AI call after tool execution uses the same `modelConfig.provider/model` (which could be GPT) but passes no `fallback`:

```typescript
aiResult = await callAI({
  provider: modelConfig.provider,
  model: modelConfig.model,
  // ❌ no fallback here — if GPT fails, the whole tool loop dies
});
```

When GPT hits rate limits mid-tool-loop, the function either crashes or returns an empty reply, leading to the "[STOP] I processed the data but couldn't generate a text response" message users see.

**Fix**: Add `fallback: { provider: "gemini", model: "gemini-2.5-pro" }` to the tool loop follow-up call.

---

### Issue 5 — `ringcentral-sip-provision` 400 errors on every page load

Every time an admin user loads the app, `useWebPhone` tries to initialize and hits the `ringcentral-sip-provision` edge function which returns 400. While the hook now handles this gracefully (from the previous fix), the error still fires on every session start unnecessarily.

**Fix**: Already handled — `useWebPhone.ts` was patched in a previous session. No action needed.

---

## Summary of Files to Change

| File | Change |
|---|---|
| `supabase/functions/_shared/aiRouter.ts` | Route complex agents to `gemini-2.5-pro` directly; increase default `maxTokens` to 4000 |
| `supabase/functions/ai-agent/index.ts` | Add `fallback` to the tool loop follow-up `callAI` call |
| `supabase/functions/admin-chat/index.ts` | Increase the internal rate limit window or threshold |

---

## Why the Agents Feel "Brainless"

The agents' system prompts, personas, and tools are all intact and correct. The prompts for Penny, Blitz, Forge, Gauge, etc. are rich and detailed. The problem is purely at the **model layer**: agents that need `gemini-2.5-pro` for quality reasoning are getting `gemini-2.5-flash` (which is optimized for speed, not depth), producing shallow, surface-level answers.

Routing them directly to `gemini-2.5-pro` from the start (bypassing the failed GPT → flash fallback path) will immediately restore full intelligence.

---

## After These Fixes

- Accounting (Penny), Legal (Tally), and Empire (Architect) → use `gemini-2.5-pro` directly
- All other agents → use `gemini-2.5-flash` with 4000 token limit (2× current)
- Tool loops → survive GPT failures gracefully
- Admin chat → stops rate-limiting legitimate users
- Edge function deployment required after changes
