

# Audit and Improvement: AI App Builder Execution Discipline

## Current State (What's Already Working)

The previous deployment successfully implemented the foundation:

- EXECUTOR system prompt block (lines 2291-2327) -- action states, write safety rules, completion contract
- `resolve_task` 20-character minimum validation (both handler instances)
- Write throttle: `MAX_DB_WRITES_PER_TURN = 3`
- Multi-statement guard (semicolon split check)
- Destructive pattern blocking (DROP TABLE, TRUNCATE, etc.)
- 4000-character query length cap
- Safe serialization on `db_read_query` (8000-char truncation, 50-row cap)
- Audit logging to `activity_events` for all `db_write_fix` calls
- `[STOP]` amber banner and `[FIX_CONFIRMED]` green banner in UI

## Gaps Found (What's Missing)

### Gap 1: `resolve_task` Tool Definition Lacks Evidence Fields
The tool only accepts `task_id`, `resolution_note`, and `new_status`. The user's blueprint requires `before_evidence`, `after_evidence`, `regression_guard`, and `scope` fields. Without these, the agent can still write a vague 20-char note and resolve.

### Gap 2: `resolve_task` Handler Doesn't Validate Evidence Content
The 20-char check is too weak. The note could be "Fixed the thing by doing stuff" (35 chars) and pass. No keyword/evidence marker validation exists.

### Gap 3: `db_write_fix` Result Not Safely Serialized
Read results are truncated at 8000 chars, but write results (`fixResult`) are passed raw. A write returning a large payload could overflow the context window.

### Gap 4: `db_write_fix` Missing GRANT/REVOKE Blocking
The destructive pattern regex blocks `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, and `ALTER TABLE...DROP`, but does NOT block `GRANT` or `REVOKE` -- privilege escalation vectors.

### Gap 5: No `[STOP]` Marker Stripping from Rendered Markdown
The `[FIX_CONFIRMED]` marker is displayed raw in the markdown alongside the banner. Same for `[STOP]`. These markers should be stripped from the rendered text so users see the banner only, not the raw tag.

### Gap 6: System Prompt Missing "Investigate" in Banned Words
The user's spec bans "I investigated" but the current prompt only bans "I found", "I checked", "I inspected", "I verified". Missing: "I investigated", "I confirmed", "I reviewed".

---

## Implementation Plan

### 1. Upgrade `resolve_task` Tool Definition
**File:** `supabase/functions/ai-agent/index.ts` (lines 6655-6664)

Add optional but encouraged evidence fields to the tool schema:
- `before_evidence` (string) -- state before the fix
- `after_evidence` (string) -- verification output proving the fix
- `regression_guard` (string) -- what prevents recurrence

### 2. Harden `resolve_task` Handler Validation
**File:** `supabase/functions/ai-agent/index.ts` (both handler instances, lines ~7586 and ~8414)

Strengthen validation:
- Keep 20-char minimum
- Add keyword check: resolution note must contain at least one evidence marker word (e.g., "updated", "inserted", "deleted", "created", "fixed", "removed", "added", "changed", "applied", "rows_affected", "verified", "confirmed via query")
- Log `before_evidence`, `after_evidence`, and `regression_guard` into the `activity_events` metadata when provided

### 3. Add Safe Serialization to `db_write_fix` Results
**File:** `supabase/functions/ai-agent/index.ts` (both write handler instances, lines ~8224-8245 and ~8656-8666)

After receiving `fixResult`, truncate if serialized length exceeds 8000 chars -- same pattern used for read results. This prevents context window overflow on large write returns.

### 4. Block GRANT/REVOKE in Write Gateway
**File:** `supabase/functions/ai-agent/index.ts` (both write handler instances)

Expand the destructive pattern regex from:
```
/\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+|ALTER\s+TABLE\s+\S+\s+DROP\s+)/i
```
To:
```
/\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+|ALTER\s+TABLE\s+\S+\s+DROP\s+|GRANT\s+|REVOKE\s+)/i
```

### 5. Strip `[STOP]` and `[FIX_CONFIRMED]` from Rendered Markdown
**File:** `src/pages/EmpireBuilder.tsx` (around lines 540-578)

In the markdown rendering block, strip both `[STOP]` and `[FIX_CONFIRMED]` markers from the displayed text so users only see the colored banners, not raw tags embedded in the message.

### 6. Expand Banned Narration Words in System Prompt
**File:** `supabase/functions/ai-agent/index.ts` (line 2296)

Update the ABSOLUTE RULES line from:
```
"I found", "I checked", "I inspected", or "I verified"
```
To:
```
"I found", "I checked", "I inspected", "I verified", "I investigated", "I confirmed", or "I reviewed"
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | resolve_task schema + validation hardening, write result serialization, GRANT/REVOKE blocking, expanded banned words |
| `src/pages/EmpireBuilder.tsx` | Strip `[STOP]` and `[FIX_CONFIRMED]` markers from rendered markdown |

## No Database Changes Required

All changes are code-level: tool definitions, handler logic, system prompt text, and UI rendering.

## What This Prevents

- **Vague resolutions** -- evidence keywords required in resolution notes
- **Context overflow** -- write results now safely truncated like read results
- **Privilege escalation** -- GRANT/REVOKE blocked at the gateway
- **Raw marker display** -- users see clean banners, not `[STOP]` text in messages
- **Narration loopholes** -- expanded banned word list closes gaps
