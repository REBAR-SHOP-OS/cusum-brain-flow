

# Upgrade: Frontend Task Intelligence + Remaining .catch() Bug Fixes

## Summary

Two categories of changes in `supabase/functions/ai-agent/index.ts`:

1. **System prompt upgrade** -- Add Task Type Classification, UI inspection protocol, and structured patch template requirements so the agent stops collapsing into "context incomplete" on frontend tasks.
2. **Bug fix** -- Replace remaining `.catch(() => {})` calls on Supabase `.insert()` with `try/catch` blocks to prevent the same runtime crash that broke `resolve_task`.

---

## Change 1: Task Type Classification Block (System Prompt)

**File:** `supabase/functions/ai-agent/index.ts` (~line 2329, after PLANNING PHASE, before ERROR CLASSIFICATION)

Insert a new mandatory classification step that forces the agent to categorize every task before acting:

```text
TASK TYPE CLASSIFICATION (MANDATORY before any tool call):
Before calling ANY tool, classify the task:

| Type             | Scope                         | Tools to Use                  |
|------------------|-------------------------------|-------------------------------|
| UI_LAYOUT        | Page structure, grid, spacing | generate_patch                |
| UI_STYLING       | CSS, responsive, images       | generate_patch                |
| DATA_PERMISSION  | RLS, auth, access denied      | db_read_query → db_write_fix  |
| DATABASE_SCHEMA  | Missing columns, tables       | db_read_query → db_write_fix  |
| ERP_DATA         | Odoo/QB records, sync issues  | odoo_write, db_write_fix      |
| TOOLING          | Tool bugs, integration errors | [STOP] + escalate             |

Output format (required in first response):
TASK_TYPE: <type>
SCOPE: <page or module>
TARGET: <specific element>
DEVICE: <all | mobile | desktop> (if UI)

Rules:
- If TASK_TYPE is UI_LAYOUT or UI_STYLING, do NOT call db_read_query or ERP tools.
- If TASK_TYPE is ERP_DATA, do NOT call generate_patch.
- Misclassification wastes a tool turn. Classify correctly the first time.
```

---

## Change 2: UI Inspection Protocol (System Prompt)

**File:** `supabase/functions/ai-agent/index.ts` (~line 2489, extend FALLBACK PROTOCOL section)

Add mandatory inspection-before-patching rules after the existing Step 3:

```text
- **Step 4 (UI tasks only):** Before generating a patch, state what you expect to find:
  * Current HTML structure (img tags, containers, classes)
  * Current CSS properties (width, max-width, object-fit, srcset)
  * Breakpoint coverage (@media queries)
  Never patch blind. If you cannot inspect the component, say what file you need.

- **Step 5:** Use structured patch format:
  * file: exact path
  * change_type: css | jsx | html
  * before_snippet: what exists now (or "unknown — needs inspection")
  * after_snippet: proposed change
  * reason: why this fixes the issue
  If you cannot fill file + after_snippet, STOP and request the missing info.
```

---

## Change 3: Tool Failure vs. Clarity Failure Rule (System Prompt)

**File:** `supabase/functions/ai-agent/index.ts` (~line 2347, add after existing ERROR CLASSIFICATION rules)

```text
TOOL FAILURE vs. CLARITY FAILURE (MANDATORY distinction):
If a task was clearly understood AND a tool failed:
- Do NOT ask for clarification.
- Instead: classify the failure source (TOOL_BUG, PERMISSION_MISSING, etc.)
- Provide the exact missing dependency (file path, repo access, build environment).
- STOP.

The phrase "context incomplete" is BANNED unless you can prove the user's request was ambiguous.
If the user said what page, what element, and what change — context is complete.
A tool failure is NOT incomplete context.
```

---

## Change 4: Fix Remaining .catch() Bugs (Runtime)

**File:** `supabase/functions/ai-agent/index.ts`

There are 8 remaining `.catch(() => {})` calls on `svcClient.from(...).insert(...)` that will crash at runtime (same bug as resolve_task). All are best-effort activity logging -- wrap each in try/catch.

Lines to fix (all in the multi-turn tool loop handlers):

| Line | Handler | Current | Fix |
|------|---------|---------|-----|
| 8048 | create_fix_ticket (1st pass) | `.catch(() => {})` | `try/catch` |
| 8079 | update_fix_ticket (1st pass) | `.catch(() => {})` | `try/catch` |
| 8182 | diagnose_from_screenshot | `.catch(() => {})` | `try/catch` |
| 8304 | db_write_fix (1st pass) | `.catch(() => {})` | `try/catch` |
| 8610 | create_fix_ticket (multi-turn) | `.catch(() => {})` | `try/catch` |
| 8635 | update_fix_ticket (multi-turn) | `.catch(() => {})` | `try/catch` |
| 8753 | db_write_fix (multi-turn) | `.catch(() => {})` | `try/catch` |

Each replacement pattern:

Before:
```javascript
await svcClient.from("activity_events").insert({ ... }).catch(() => {});
```

After:
```javascript
try { await svcClient.from("activity_events").insert({ ... }); } catch (_) { /* best-effort logging */ }
```

Note: Line 4388 (`.then().catch()`) and line 8439 (`.catch()` on `followUp.text()`) are safe -- those are on fetch Promises, not Supabase query builders.

---

## Change 5: Smarter Empty-Reply Fallback for Patch Results

**File:** `supabase/functions/ai-agent/index.ts` (~line 8807, in the reply synthesis block)

Currently the synthesis block only handles `db_read_query`. Add handling for `generate_patch` results so successful patches don't get swallowed by the generic "context incomplete" fallback:

```javascript
if (r.name === "generate_patch" && r.result?.success) {
  return `Patch created for \`${r.result.artifact?.file || "unknown"}\`:\n- Patch ID: ${r.result.patch_id}\n- Status: Awaiting review\n- Description: ${r.result.message}`;
}
```

---

## Technical Summary

| # | Type | Location | Change |
|---|------|----------|--------|
| 1 | Prompt | ~line 2329 | Task Type Classification block |
| 2 | Prompt | ~line 2489 | UI Inspection Protocol (steps 4-5) |
| 3 | Prompt | ~line 2347 | Tool Failure vs Clarity Failure rule |
| 4 | Bug fix | 7 lines | Replace .catch() with try/catch on activity_events inserts |
| 5 | Logic | ~line 8807 | Add generate_patch to reply synthesis |

## What This Fixes

- Agent classifies UI tasks correctly and stops calling DB/ERP tools for CSS issues
- Agent inspects components before patching (no more "blind patches")
- "Context incomplete" is banned when the task was clearly stated -- tool failures are classified instead
- 7 remaining `.catch()` runtime bugs are fixed (same class as the resolve_task crash)
- Successful `generate_patch` results are surfaced in the reply instead of being swallowed

## No Changes To

- Database schema
- Dependencies
- Frontend code
- Other edge functions

