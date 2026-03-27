

# Fix: AI Estimate Fails on Truncated JSON Response

## Problem
The `ai-estimate` edge function fails when the AI model returns a large JSON array that gets truncated (13,995 chars, near the 16,000 token limit). The truncated response has no closing `]`, so:
1. `JSON.parse(cleaned)` fails — incomplete JSON
2. Regex `/\[[\s\S]*\]/` finds no match — missing closing bracket
3. Falls through to "No JSON array found" → zero items → "Zero-weight guard" error

## Solution
Two fixes in `supabase/functions/ai-estimate/index.ts`:

### Fix 1: Repair truncated JSON before parsing (~line 535-552)
After stripping markdown fences, add a truncation repair step:
- If the cleaned string starts with `[` but doesn't end with `]`, find the last complete object (`}`) and close the array with `]`
- This salvages all complete items from a truncated response

```ts
// After line 535 (let cleaned = ...)
// Repair truncated JSON arrays
if (cleaned.startsWith("[") && !cleaned.trimEnd().endsWith("]")) {
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0) {
    cleaned = cleaned.substring(0, lastBrace + 1) + "]";
    console.log("Repaired truncated JSON array");
  }
}
```

### Fix 2: Increase max_tokens to reduce truncation (~line 521)
Change `max_tokens: 16000` → `max_tokens: 32000` to give the model more room for large bar lists.

## Files changed
- `supabase/functions/ai-estimate/index.ts` — add JSON truncation repair + increase max_tokens

