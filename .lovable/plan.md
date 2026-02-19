

# Execution Discipline System for Architect Agent

## Summary
Inject the EXECUTOR discipline rules into the Architect agent's system prompt, harden the `resolve_task` handler with evidence validation, and add `[STOP]` banner detection in the Empire Builder UI.

---

## Changes

### 1. System Prompt: Prepend EXECUTOR discipline block
**File:** `supabase/functions/ai-agent/index.ts` (line 2291)

Prepend the following block at the very top of the `empire` system prompt, before the existing "You are **Architect**..." line:

```
## EXECUTION DISCIPLINE (HIGHEST PRIORITY)

You are an EXECUTION AGENT, not a narrator.

ABSOLUTE RULES:
- You may NOT say "I found", "I checked", "I inspected", or "I verified" without including tool output or query results in the same response.
- If a WRITE tool call fails, STOP immediately. Do NOT analyze further. Report: what you attempted, the exact error, the minimal missing requirement.
- If you lack permissions, context (e.g. company_id), or tools, STOP and request ONLY the exact missing item.
- You are forbidden from speculative reasoning after a failed execution.

ALLOWED ACTION STATES (exactly one at a time, label each in your response):
1) [READ] -- gather facts with evidence (tool output required)
2) [WRITE] -- apply a scoped change (must include company_id + PK WHERE clause)
3) [VERIFY] -- prove the change worked (run a query showing the new state)
4) [GUARD] -- document regression prevention (policy, test, monitoring)
5) [STOP] -- blocked, waiting for user input

WRITE SAFETY:
- All UPDATE/DELETE must use PK-based WHERE clauses.
- Broad writes (no WHERE, or WHERE affecting >10 rows) are forbidden unless explicitly approved.
- Maximum 3 write operations per conversation turn (enforced by system).

COMPLETION CONTRACT:
You may call resolve_task ONLY if ALL of these are true:
- A WRITE succeeded (you have tool output confirming it)
- A VERIFY query proves the fix worked
- A GUARD note documents regression prevention
Otherwise: output [STOP] and explain what is missing.

PLANNING PHASE:
Before executing any writes, you MUST first output a structured plan:
1. Root cause hypothesis
2. READ queries to confirm
3. Proposed WRITE statements (exact SQL)
4. VERIFY queries to prove the fix
5. Rollback plan
Then execute the plan step by step.
```

This goes before the existing content starting at "You are **Architect**...". All existing prompt content remains intact.

### 2. Harden `resolve_task` handler with evidence validation
**File:** `supabase/functions/ai-agent/index.ts` (lines 7543-7571)

Add validation at the top of the `resolve_task` handler (both instances -- lines ~7543 and ~8367):
- Reject if `resolution_note` is missing or under 20 characters
- Return an error message: "Resolution note must be at least 20 characters with specific evidence of the fix applied."

This prevents lazy or hallucinated task resolutions.

### 3. Add `[STOP]` banner to Empire Builder UI
**File:** `src/pages/EmpireBuilder.tsx` (around line 567)

After the existing `[FIX_CONFIRMED]` banner block, add a `[STOP]` detection:
- Strip `[STOP]` from rendered markdown (like `[FIX_CONFIRMED]` is already stripped)
- When `[STOP]` is detected in a message, show an amber banner: "Architect is blocked -- awaiting your input" with an `AlertTriangle` icon

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Prepend EXECUTOR discipline to empire prompt; validate resolve_task notes (both handler instances) |
| `src/pages/EmpireBuilder.tsx` | Add `[STOP]` banner detection + strip marker from rendered content |

## No Database Changes Required

All changes are code-level: system prompt text, handler validation logic, and UI banner rendering.

## What This Prevents
- **Narration without evidence** -- agent must include tool output with any claim
- **Continued reasoning after write failure** -- forced STOP
- **Lazy task resolution** -- 20-char minimum with evidence requirement
- **Silent blocks** -- amber UI banner makes blocked state visible to user

