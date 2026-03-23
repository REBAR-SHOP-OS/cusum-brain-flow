

## Fix GPT/Gemini AI Call Failures — Minimal Safe Patches

### Root Causes Found

**Bug 1 — `summarize-meeting` missing import (CRASH)**
`supabase/functions/summarize-meeting/index.ts` calls `callAI()` on line 134 but never imports it. This function will throw `ReferenceError: callAI is not defined` every time it runs.

**Bug 2 — GPT-5 temperature constraint not enforced**
Per project memory: GPT-5 only supports `temperature: 1.0`. The `_callAISingle` function in `aiRouter.ts` defaults temperature to `0.5`, which causes 400 errors when any caller uses GPT-5 models. The streaming path `_callAIStreamSingle` has the same issue.

**Bug 3 — Streaming path missing GPT-5 `max_completion_tokens`**
`_callAISingle` (line 94) correctly uses `max_completion_tokens` for GPT-5, but `_callAIStreamSingle` (line 142) always uses `max_tokens` — will cause 400 errors for GPT-5 streaming calls.

**Bug 4 — `analyze-scope` bypasses `aiRouter`**
Uses the Lovable gateway directly with hardcoded fetch. Not a crash bug, but misses retry/fallback/usage-logging. Low priority — no fix in this wave.

---

### Patches (3 files, minimal)

**Patch 1: `supabase/functions/summarize-meeting/index.ts`**
- Add `import { callAI } from "../_shared/aiRouter.ts";` on line 3
- Category: **safe scoped bug fix** — function currently broken, this makes it work
- Rollback: remove the import line

**Patch 2: `supabase/functions/_shared/aiRouter.ts`**
Two fixes in the same file:

a) **GPT-5 temperature fix** — In both `_callAISingle` and `_callAIStreamSingle`, after setting temperature, add:
```typescript
// GPT-5 only supports temperature=1.0
if (model.startsWith("gpt-5")) {
  body.temperature = 1;
}
```

b) **Streaming `max_completion_tokens`** — In `_callAIStreamSingle` line 142, apply same GPT-5 check as `_callAISingle`:
```typescript
if (opts.maxTokens) {
  if (model.startsWith("gpt-5")) {
    body.max_completion_tokens = opts.maxTokens;
  } else {
    body.max_tokens = opts.maxTokens;
  }
}
```

- Category: **safe scoped bug fix** — fixes 400 errors on GPT-5 calls
- No behavior change for non-GPT-5 models
- Rollback: revert file

---

### Files Changed

| File | Change | Category | Rollback |
|---|---|---|---|
| `supabase/functions/summarize-meeting/index.ts` | Add missing `callAI` import | Safe bug fix | Remove import |
| `supabase/functions/_shared/aiRouter.ts` | GPT-5 temperature + streaming max_tokens fix | Safe bug fix | Revert file |

### Not Touched
- No route changes
- No DB schema changes
- No business logic changes
- `analyze-scope` left as-is (works, just not using shared router)
- All 49 other `callAI` consumers unchanged — they already import correctly

