

## Plan: Fix "No prompt returned" Error in AI Prompt Dialog

### Root Cause
Backend `ad-director-ai` (write-script) returns successfully (logs show 200 OK, ~3-4s). The bug is in the **client response shape**.

The edge function returns:
```json
{ "result": { "text": "..." }, "modelUsed": "...", "fallbackUsed": false, "taskType": "write-script" }
```

But `ChatPromptBar.tsx` reads:
```ts
const result = await invokeEdgeFunction<{ text?: string }>(...);
return result?.text ?? null;   // ❌ always null — text is at result.result.text
```

So `text` is always `null` → "No prompt returned" toast fires.

### Fix (1 file, surgical)

**`src/components/ad-director/ChatPromptBar.tsx`** — `runAiWrite()`:
- Update the type to `{ result?: { text?: string }; text?: string }` (defensive)
- Read `result?.result?.text ?? result?.text ?? null` so it works regardless of wrapping

That's it. No backend changes, no other components touched.

### What stays the same
- Edge function `ad-director-ai` — unchanged
- Dialog UI, chips, regenerate, "Use this prompt" — unchanged
- All other handlers and flows — unchanged

### Result
کلیک روی **AI Prompt** → دیالوگ باز می‌شود → پرامت تولیدشده توسط AI نمایش داده می‌شود (دیگر "No prompt returned" نمی‌دهد).

