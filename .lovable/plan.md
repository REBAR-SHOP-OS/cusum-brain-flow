
# AI Connection Full Audit — Complete Diagnosis

## The Root Cause of "Huge Problem"

**`callAIStream` does not exist in `aiRouter.ts`.**

The shared AI router (`supabase/functions/_shared/aiRouter.ts`) exports only: `callAI`, `selectModel`, `AIError`, and type definitions. It does **NOT** export `callAIStream`. But 5 deployed edge functions import it directly:

| Function | What Breaks |
|---|---|
| `app-help-chat` | In-app help chat widget is completely broken — runtime import error |
| `website-chat` | Public website chatbot broken — crashes on first message |
| `website-agent` | Website AI agent broken — all tool calls fail |
| `seo-ai-copilot` | SEO Copilot streaming broken — 500 on every message |
| `admin-chat` | JARVIS admin chat / Vizzy broken — all streaming AI dead |

When Deno tries to load these functions, it will throw `SyntaxError: The requested module does not provide an export named 'callAIStream'`. **Every function listed above crashes at startup** — they never process a single request successfully.

This is the "huge problem." The fix is to add `callAIStream` to `aiRouter.ts` as a proper streaming wrapper.

---

## Complete AI Connection Inventory

### Tier 1 — Uses `callAI` (Non-Streaming) — `aiRouter.ts` ✅ WORKING

These functions call `callAI()` from `aiRouter.ts`, which is correctly exported. They use `GPT_API_KEY` for OpenAI or `GEMINI_API_KEY` for Google:

| Function | Provider | Model | Purpose |
|---|---|---|---|
| `ai-agent` | GPT/Gemini (auto) | gpt-4o / gemini-2.5-pro | Main multi-agent system |
| `translate-message` | Gemini | gemini-2.5-flash-lite | Team chat translation |
| `vizzy-briefing` | Gemini | gemini-2.5-flash | Context compression for Vizzy |
| `vizzy-daily-brief` | Gemini | gemini-2.5-pro | Daily briefing generation |
| `empire-architect` | GPT | gpt-4o-mini | Venture analysis |
| `summarize-call` | GPT/Gemini | gpt-4o | Call summary |
| `seo-ai-analyze` | GPT/Gemini | gpt-4o | SEO analysis |
| `support-chat` | GPT/Gemini | varies | Customer support AI (JARVIS) |
| `agentQA.ts` | Gemini | gemini-2.5-flash | QA reviewer layer |
| `notifyTranslate.ts` | Gemini | gemini-2.5-flash-lite | Push notification translation |

Both `GPT_API_KEY` and `GEMINI_API_KEY` are **confirmed present** in secrets.

### Tier 2 — Uses `callAIStream` — BROKEN (Function Missing)

These 5 functions import a function that **does not exist**:

| Function | Provider | Model | Users Affected |
|---|---|---|---|
| `app-help-chat` | GPT | gpt-4o-mini | Every user clicking the help `?` button |
| `website-chat` | GPT | gpt-4o-mini | All rebar.shop public visitors |
| `website-agent` | Gemini | gemini-2.5-flash | rebar.shop product/quote chatbot |
| `seo-ai-copilot` | Gemini | gemini-2.5-flash | SEO team chat |
| `admin-chat` | GPT/Gemini | gpt-4o / gemini-2.5-pro | JARVIS / Vizzy admin assistant |

### Tier 3 — Uses Lovable AI Gateway (`LOVABLE_API_KEY`) — Semi-Working

These functions bypass `aiRouter.ts` and call `https://ai.gateway.lovable.dev` directly:

| Function | Model | Notes |
|---|---|---|
| `ai-estimate` | (default via gateway) | Estimation document extraction |
| `analyze-scope` | (default via gateway) | Scope analysis from files |
| `auto-generate-post` | (image model) | Social media image generation |

`LOVABLE_API_KEY` is confirmed present. These work but are isolated from the main router — no fallback, no rate limit tracking.

### Tier 4 — Direct API Calls (No Router) — Working but Isolated

| Function | API Used | Model |
|---|---|---|
| `generate-image` | OpenAI Images API | gpt-image-1 / dall-e-3 |
| `generate-video` | Gemini Veo API | veo-3.0 |
| `pipeline-ai` | Gemini directly | gemini-2.5-flash |
| `google-vision-ocr` | Google Vision API | vision-v1 |
| `elevenlabs-*` | ElevenLabs API | TTS/STT |

---

## Secondary Issues Found

### Issue 2 — `pipeline-ai` Has Its Own Inline AI Call (Not Using Router)
`pipeline-ai/index.ts` line 35-60 defines its own `callAI()` locally, calling Gemini directly using `GEMINI_API_KEY`. This means it gets **no fallback**, **no centralized logging**, and **no rate limit protection**. It works but is fragile.

### Issue 3 — `admin-chat` Is 1,567 Lines — Uses Both `callAIStream` AND Direct API Pattern
`admin-chat` is the most critical function (it powers JARVIS). At 1,567 lines, it's massive. Because it imports `callAIStream` which doesn't exist, **the entire admin AI assistant is completely non-functional**.

### Issue 4 — Build Blocker (Ongoing)
The `document_embeddings` / vector extension migration conflict is still blocking deployment, which means **none of the above fixes will reach Live until the migration is resolved**.

---

## Fix Plan

### Fix 1 — Add `callAIStream` to `aiRouter.ts` (Critical — Fixes 5 Functions)

`callAIStream` needs to be a streaming wrapper that:
1. Builds the same request body as `callAI`
2. Passes `stream: true` to OpenAI/Gemini
3. Returns the raw `Response` object (so the caller can pipe `response.body` directly to the client)

```typescript
// Add to aiRouter.ts
export async function callAIStream(opts: AIRequestOptions): Promise<Response> {
  const provider = opts.provider || "gpt";
  const model = opts.model || "gpt-4o";
  const { url, apiKey } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
    stream: true,
  };

  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AIError(`AI API error: ${response.status} — ${errText}`, response.status);
  }

  return response; // Caller pipes response.body as SSE stream
}
```

### Fix 2 — Resolve `document_embeddings` Migration Conflict

Change the migration to use `DROP ... CASCADE` instead of attempting to drop the extension without its dependents:

```sql
DROP EXTENSION IF EXISTS vector CASCADE; -- removes all dependent objects
CREATE EXTENSION IF NOT EXISTS vector;
-- Then recreate table, function, indexes, policies
```

This resolves the "cannot drop extension vector because other objects depend on it" error.

### Fix 3 — Migrate `pipeline-ai` to Use Shared Router (Low Priority)
Replace the inline `callAI()` in `pipeline-ai/index.ts` with `import { callAI } from "../_shared/aiRouter.ts"` to gain centralized error handling and fallback support.

---

## File Changes Required

| File | Change |
|---|---|
| `supabase/functions/_shared/aiRouter.ts` | Add `callAIStream` export — fixes all 5 broken streaming functions |
| `supabase/migrations/20260220140325_*.sql` | Fix with `DROP ... CASCADE` to clear build blocker |
| `supabase/functions/pipeline-ai/index.ts` | Replace inline AI call with shared router (low priority) |

**No frontend changes needed** — the broken functions are all backend edge functions.

## Impact Summary

Fixing `callAIStream` alone re-enables:
- JARVIS / admin chat (`admin-chat`)
- The in-app help `?` button (`app-help-chat`)  
- The rebar.shop public website chatbot (`website-chat` + `website-agent`)
- The SEO Copilot chat (`seo-ai-copilot`)

These are the highest-traffic AI touchpoints in the entire system.
