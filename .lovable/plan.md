
# ARIA App Builder — Audit and Hardening Plan

## Audit Findings

### FINDING 1: Missing Write Throttle on `db_write_fix` (HIGH)
**Before evidence:** The `db_write_fix` handler (lines 8138-8192 first-pass, lines 8552-8590 multi-turn) has NO per-session write counter. The AI can execute unlimited writes in a single conversation turn across 5 loop iterations. The global rate limiter (10 req/60s on `ai-agent`) only limits top-level API calls, not individual write operations within the multi-turn loop.

**Risk:** A single user prompt could trigger up to 5 write operations (MAX_TOOL_ITERATIONS = 5) with no throttle between them.

### FINDING 2: Missing Query Length Cap (MEDIUM)
**Before evidence:** Neither `db_read_query` nor `db_write_fix` validates the length of the `query` string. An LLM could generate an enormous SQL string that overwhelms the database or times out.

### FINDING 3: Missing Multi-Statement Guard on `db_write_fix` (HIGH)
**Before evidence:** `db_read_query` blocks multi-statement injection via regex `/;\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i`, but `db_write_fix` has NO equivalent guard. It only blocks destructive patterns (DROP TABLE, TRUNCATE). This means the AI could chain `UPDATE ...; DELETE ...` in a single call, bypassing the "single scoped statement" rule.

### FINDING 4: Duplicate Handlers — First-Pass vs Multi-Turn (LOW)
**Before evidence:** `db_read_query` and `db_write_fix` are handled in BOTH the first-pass tool handler block (~lines 8088-8192) AND the multi-turn loop block (~lines 8507-8590). The logic is identical, creating maintenance risk but no functional bug (the multi-turn handlers override via the `handledNames` list at line 8592).

### FINDING 5: Unsafe JSON Serialization in Tool Results (LOW)
**Before evidence:** When `db_read_query` returns large datasets, the result is sliced to 50 rows but no size cap on the total JSON payload. A row with very large text columns could still produce oversized tool results that blow up the LLM context window.

### FINDING 6: `execute_write_fix` Has No Statement-Count Guard (MEDIUM)
**Before evidence:** The database function `execute_write_fix` runs `EXECUTE sql_query` with no check that the input contains only a single statement. Multi-statement attacks (if they bypass the edge function regex) would execute fully.

---

## Plan: 5 Surgical Changes (1 file + 1 migration)

### Change 1: Add write throttle to `db_write_fix` (both handlers)
Add a session-scoped write counter. Cap at 3 writes per conversation turn.

In both the first-pass handler (~line 8138) and multi-turn handler (~line 8552), add a check against a `dbWriteCount` variable initialized before the tool loop:
```typescript
// Before the first-pass tool handler block:
let dbWriteCount = 0;
const MAX_DB_WRITES_PER_TURN = 3;

// Inside db_write_fix handler, before executing:
if (dbWriteCount >= MAX_DB_WRITES_PER_TURN) {
  seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: `Write throttle: max ${MAX_DB_WRITES_PER_TURN} writes per turn reached. Send a new message to continue.` } });
} else {
  // ... existing logic ...
  dbWriteCount++;
}
```

### Change 2: Add query length cap (both `db_read_query` and `db_write_fix`)
Cap queries at 4000 characters to prevent oversized SQL:
```typescript
if (query.length > 4000) {
  seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: "Query exceeds 4000 character limit." } });
}
```

### Change 3: Add multi-statement guard to `db_write_fix`
Block semicolon-separated statements to enforce single-statement writes:
```typescript
const multiStmt = query.replace(/--[^\n]*/g, "").split(";").filter(s => s.trim().length > 0);
if (multiStmt.length > 1) {
  seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: "Only single SQL statements allowed. Split into separate db_write_fix calls." } });
}
```

### Change 4: Add safe serialization cap to tool results
Truncate tool result JSON to 8000 chars max to prevent context window blowups:
```typescript
const resultJson = JSON.stringify(result);
const safeResult = resultJson.length > 8000 
  ? JSON.parse(resultJson.substring(0, 8000) + '..."}}') // won't work — use below
  : result;
// Better approach: truncate at row level
const rows = Array.isArray(data) ? data.slice(0, 30) : data;
const serialized = JSON.stringify(rows);
const safeRows = serialized.length > 8000 
  ? JSON.parse(JSON.stringify(Array.isArray(data) ? data.slice(0, 10) : data))
  : rows;
```

### Change 5: Database migration — add single-statement guard to `execute_write_fix`
Add a server-side check inside the function as a defense-in-depth layer:
```sql
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_rows integer;
  stmt_count integer;
BEGIN
  -- Guard: reject if multiple statements detected
  SELECT COUNT(*) INTO stmt_count
  FROM regexp_split_to_table(
    regexp_replace(sql_query, '--[^\n]*', '', 'g'),
    ';'
  ) s WHERE trim(s) != '';
  
  IF stmt_count > 1 THEN
    RETURN jsonb_build_object('error', 'Only single SQL statements allowed');
  END IF;
  
  -- Guard: max query length
  IF length(sql_query) > 4000 THEN
    RETURN jsonb_build_object('error', 'Query exceeds 4000 character limit');
  END IF;

  EXECUTE sql_query;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_rows', affected_rows);
END;
$$;
```

---

## What This Does NOT Touch
- No UI changes
- No other agents affected
- No schema changes to existing tables
- No changes to `db_read_query` RPC function (read-only, lower risk)
- Multi-turn loop logic unchanged
- All existing tool handlers preserved
- Admin-only route guard (`AdminRoute`) already in place at `/empire`

## Regression Prevention
- Write throttle prevents runaway multi-turn writes
- Query length cap prevents DoS via oversized SQL
- Multi-statement guard at BOTH edge function AND database level (defense-in-depth)
- Safe serialization prevents LLM context window overflow
- All writes continue to be audit-logged to `activity_events`
