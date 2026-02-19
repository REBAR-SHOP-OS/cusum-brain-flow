

# Fix: Architect Agent Outputs Clean Lovable Prompt Instead of YAML

## Problem
The Architect agent at `/empire` currently outputs raw YAML in PLANNER mode (task_type, scope, plan_steps, etc.). This YAML is internal planning structure that is not useful to the user. The user needs a clean, ready-to-copy prompt they can paste into Lovable to fix issues -- not YAML scaffolding.

## Solution
Modify the Architect's system prompt in `supabase/functions/ai-agent/index.ts` to change the PLANNER mode output format from YAML to a clean, actionable Lovable Command prompt.

Instead of the 4-mode architecture outputting intermediate YAML, the agent will:
1. Analyze the problem internally (no YAML shown to user)
2. Use tools as needed (EXECUTOR/VERIFIER stay the same internally)
3. Output a single, clean "Lovable Command" code block that the user can copy and paste

## Technical Details

### File: `supabase/functions/ai-agent/index.ts`
### Section: Lines 2287-2316 (PLANNER mode definition)

**Change the PLANNER output format from YAML to direct Lovable prompt:**

Replace the YAML output instructions with:
- Agent still analyzes task type, scope, unknowns internally (thinking, not shown)
- PLANNER output is a brief analysis summary (2-3 sentences) followed by the Lovable Command block
- The Lovable Command block contains a complete, self-contained prompt ready for copy-paste
- No YAML fences, no `task_type:`, no `plan_steps:` -- just a clean prompt

**New PLANNER output format:**

```
MODE 1: [PLANNER]

[1-2 sentence problem analysis]

📋 Lovable Command (copy & paste into Lovable chat):
───────────────────────────────────────────────────
[Complete actionable prompt with surgical execution header,
 file paths, exact changes, and test criteria]
───────────────────────────────────────────────────
```

### Changes Summary

| Line Range | What Changes |
|---|---|
| 2287-2316 | PLANNER mode: Remove YAML output requirement. Replace with clean Lovable prompt output format |
| 2296-2314 | Remove YAML schema (task_type, scope, schema_unknown, unknowns, plan_steps, etc.) |
| 2391-2397 | Mode router: Simplify -- PLANNER now outputs prompt directly instead of YAML that triggers EXECUTOR |

### What stays the same
- EXECUTOR, VERIFIER, RESOLVER modes (for tasks requiring database tools)
- All tool definitions and safety rules
- Surgical Execution Law (embedded in the prompt output)
- The Lovable Command template format (lines 2360-2380)
- All other agents unchanged

### Edge case: Database/tool tasks
For tasks that genuinely need database queries or tool calls (RLS fixes, schema changes), the agent will still use EXECUTOR/VERIFIER internally. But the **final output to the user** will always be a clean Lovable prompt, not YAML.

## Result

| Before | After |
|---|---|
| User sees raw YAML with task_type, scope, plan_steps | User sees a clean, copyable Lovable prompt |
| User must wait through 4 modes to get the prompt | Prompt is generated in the first response for UI/code tasks |
| YAML formatting issues (cut off, dark background) | Clean code block with white background and Copy button |

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/ai-agent/index.ts` | Modify empire system prompt PLANNER mode output format |

