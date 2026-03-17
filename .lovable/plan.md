

# Fix: Force Empire Agent to Call Tools (Not Narrate)

## Problem
The empire agent has all the right tools registered and wired up, but Gemini 2.5 Pro ignores them. With `toolChoice: "auto"`, the model chooses to respond with text like "I'll query the seo_issues table..." instead of actually calling `db_read_query` or `scrape_page`. The TOOL-FIRST RULE in the prompt is being ignored by the model.

## Root Cause
`toolChoice: "auto"` is a suggestion, not an enforcement. Gemini often prefers text responses over tool calls, especially with long system prompts that contain lots of narrative instructions.

## Fix

### 1. Force `toolChoice: "required"` for empire diagnostic requests
**File**: `supabase/functions/ai-agent/index.ts` (~line 1020)

Detect when the empire agent receives a diagnostic or fix message (keywords: "check", "diagnostic", "fix", "rebar.shop", "scrape", "audit", "report") and override `toolChoice` from `"auto"` to `"required"`. This forces the model to call at least one tool on the first turn.

After the first tool loop iteration completes, revert to `"auto"` so the model can produce a final text summary.

```text
Before:  toolChoice: "auto"  (every turn)
After:   toolChoice: "required" (first turn for empire diagnostics)
         toolChoice: "auto"     (subsequent turns)
```

### 2. Add tool-call logging for debugging
**File**: `supabase/functions/ai-agent/index.ts` (~line 1039)

Add a `console.log` inside the tool loop to track which tools are being called, making future debugging easier.

### 3. Reduce empire system prompt verbosity
**File**: `supabase/functions/_shared/agents/empire.ts`

The system prompt is ~230 lines. Gemini may be "overwhelmed" and defaulting to text. Move the TOOL-FIRST RULE to the very top of the prompt (before the role description) so it's the first thing the model sees. Also add a final user-level reinforcement message.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Force `toolChoice: "required"` for empire diagnostic messages on first turn |
| `supabase/functions/_shared/agents/empire.ts` | Move TOOL-FIRST RULE to top of prompt |
| Redeploy `ai-agent` | Apply changes |

