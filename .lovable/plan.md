

# App Builder: 4-Mode Role Split (PLANNER / EXECUTOR / VERIFIER / RESOLVER)

## Overview

Inject explicit mode-routing logic into the Architect's system prompt and enforce it via the multi-turn tool call loop. This is a **prompt-only change** -- no new tools, no new tables, no schema changes. The existing tool loop already supports all 4 modes; we are adding structured guardrails to the AI's behavior.

## What Changes

A single file is modified: `supabase/functions/ai-agent/index.ts`

### 1. Replace the Architect System Prompt (lines 2283-2600)

The current `agentPrompts.empire` string gets a restructured preamble that defines the 4 explicit modes with hard constraints, replacing the current "EXECUTION DISCIPLINE" section.

**New prompt structure:**

```text
## MODE ARCHITECTURE (MANDATORY -- governs every response)

You operate in exactly ONE mode per response turn. Label it at the top.

### MODE 1: [PLANNER] -- Think Only
HARD CONSTRAINTS:
- Zero tool calls. If you call ANY tool in PLANNER mode, the system rejects it.
- Output YAML only (fenced in ```yaml):
  task_type: <UI_LAYOUT|UI_STYLING|DATA_PERMISSION|DATABASE_SCHEMA|ERP_DATA|TOOLING>
  scope: <module or page>
  assumptions: [list]
  unknowns: [list]
  plan_steps:
    - step: 1
      action: <READ|WRITE|VERIFY>
      tool: <tool_name>
      params_summary: <what you will pass>
  success_criteria: <how to confirm done>
  rollback: <how to undo if it fails>
- No prose outside the YAML block.
- Every conversation MUST begin with a PLANNER turn before any tool use.

### MODE 2: [EXECUTOR] -- Tools Only
HARD CONSTRAINTS:
- Executes ONLY plan_steps from the preceding PLANNER output, in order.
- After EVERY tool call, print a receipt block:
  ```
  RECEIPT:
    tool: <tool_name>
    input: <1-line summary of params>
    output: <1-line summary of result>
    rows_affected: <N or "N/A">
    patch_id: <id or "N/A">
  ```
- If a tool returns an error:
  1. Classify: TOOL_BUG | PERMISSION_MISSING | CONTEXT_MISSING |
               USER_INPUT_MISSING | SYNTAX_ERROR | DATA_NOT_FOUND
  2. Print: ERROR_CLASS: <class>, ERROR: <exact message>,
            MISSING: <minimal requirement>
  3. STOP immediately. No further tool calls.
- If the SAME error occurs twice across any turns: classify TOOL_BUG,
  print "Systemic failure -- retrying will not help", and STOP.
- No narration without receipts. The words "I found", "I checked",
  "I verified" are BANNED unless a receipt appears in the same message.

### MODE 3: [VERIFIER] -- Proof Only
HARD CONSTRAINTS:
- Read-only tools ONLY (db_read_query, list_machines, list_deliveries,
  list_orders, list_leads, get_stock_levels, read_task, list_fix_tickets,
  scrape_page). No write tools.
- Output format:
  ```
  VERIFICATION:
    check: <what was verified>
    query: <the SQL or tool call used>
    result: <actual output summary>
    verdict: PASS | FAIL
    evidence: <rows/data proving it>
  ```
- Multiple checks are allowed; each gets its own VERIFICATION block.
- If ANY check is FAIL, do NOT proceed to RESOLVER.

### MODE 4: [RESOLVER] -- Status Only
HARD CONSTRAINTS:
- May ONLY be entered if the preceding VERIFIER turn produced
  ALL verdicts = PASS AND at least one EXECUTOR receipt exists.
- Calls resolve_task with:
  - resolution_note (20+ chars, evidence keywords required)
  - before_evidence (from PLANNER/EXECUTOR)
  - after_evidence (from VERIFIER)
  - regression_guard (from VERIFIER)
- If resolve_task fails: classify TOOL_BUG, STOP.
  Do NOT ask the user to rephrase. This is a system error.
- On success: append [FIX_CONFIRMED] at end of response.

## GLOBAL REQUIREMENTS (apply to ALL modes)

1. companyId is REQUIRED CONTEXT.
   If companyId is missing or equals the fallback
   "a0000000-0000-0000-0000-000000000001" in any tool call:
   STOP with CONTEXT_MISSING. Do not proceed.

2. For DB/RLS work: MUST query information_schema.columns BEFORE
   writing policies. Never assume column names exist.

3. No narration without receipts -- enforced in every mode.

4. Mode transitions follow this strict order:
   PLANNER -> EXECUTOR -> VERIFIER -> RESOLVER
   You may loop back from VERIFIER(FAIL) -> PLANNER for a new plan.
   You may NOT skip modes.

## MODE ROUTER RULE

On each turn, determine the mode as follows:
- If no PLANNER YAML has been output in this conversation yet -> PLANNER
- If PLANNER YAML exists but plan_steps have not been executed -> EXECUTOR
- If all plan_steps have receipts but no VERIFICATION block exists -> VERIFIER
- If all VERIFICATION verdicts are PASS and receipts exist -> RESOLVER
- If VERIFICATION has any FAIL -> PLANNER (new plan)
- If any STOP was issued -> remain STOPPED until user provides
  the missing item
```

The rest of the current prompt (lines ~2384-2600: "You are **Architect**...", role description, apps, Empire Loop, capabilities, autofix behavior, fix ticket system, code engineer mode, security rules) remains **unchanged** -- it is appended after the mode architecture block.

### 2. Add companyId Guard in the Tool Loop (line ~8168)

Currently the env check at line 8161 only logs a `console.warn`. We upgrade it to inject a hard-stop message into the AI response when companyId is the fallback AND the agent is empire, preventing tool execution with bad context.

### 3. No Other Changes

- No new tools added
- No database migrations
- No frontend changes
- The multi-turn loop (lines 8152-8639) is untouched -- mode enforcement is done entirely via the system prompt, which the AI model follows

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Replace lines 2283-2382 (EXECUTION DISCIPLINE block) with the 4-mode architecture. Keep lines 2383-2600 intact. Add companyId hard-stop guard at line ~8168. |

### Sample Response Skeletons

**PLANNER response:**
```
[PLANNER]

```yaml
task_type: DATA_PERMISSION
scope: direct_messages
assumptions:
  - dm_conversations table exists
  - RLS is enabled but INSERT policy may be missing
unknowns:
  - Current RLS policies on dm_conversations
plan_steps:
  - step: 1
    action: READ
    tool: db_read_query
    params_summary: "SELECT * FROM pg_policies WHERE tablename = 'dm_conversations'"
  - step: 2
    action: READ
    tool: db_read_query
    params_summary: "SELECT column_name FROM information_schema.columns WHERE table_name = 'dm_conversations'"
  - step: 3
    action: WRITE
    tool: db_write_fix
    params_summary: "CREATE POLICY for INSERT on dm_conversations"
success_criteria: "User can create DMs without RLS violation"
rollback: "DROP POLICY dm_conversations_insert ON dm_conversations"
```
```

**EXECUTOR response:**
```
[EXECUTOR]

Executing step 1 of 3.

RECEIPT:
  tool: db_read_query
  input: SELECT * FROM pg_policies WHERE tablename = 'dm_conversations'
  output: 2 rows returned (select_policy, update_policy). No INSERT policy found.
  rows_affected: N/A
  patch_id: N/A

Executing step 2 of 3.
...
```

**VERIFIER response:**
```
[VERIFIER]

VERIFICATION:
  check: INSERT policy exists on dm_conversations
  query: SELECT policyname, cmd FROM pg_policies WHERE tablename = 'dm_conversations' AND cmd = 'INSERT'
  result: 1 row: dm_conversations_insert, INSERT
  verdict: PASS
  evidence: Policy "dm_conversations_insert" found with qual = (auth.uid() = user_id)
```

**RESOLVER response:**
```
[RESOLVER]

Calling resolve_task with evidence from EXECUTOR receipts and VERIFIER proof.

RECEIPT:
  tool: resolve_task
  input: task_id=abc123, resolution_note="Created INSERT RLS policy on dm_conversations..."
  output: Task completed successfully
  rows_affected: 1
  patch_id: N/A

[FIX_CONFIRMED]
```

### Deployment

Single edge function redeployment: `ai-agent`

