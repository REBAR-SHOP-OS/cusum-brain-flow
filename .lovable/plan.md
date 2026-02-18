

# Hardening Plan: ARIA Write Gateway Guards

## Before Evidence

**Database function `execute_write_fix`** — current body has zero guards:
```sql
DECLARE
  affected_rows integer;
BEGIN
  EXECUTE sql_query;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_rows', affected_rows);
END;
```

**Edge function `ai-agent/index.ts`** — both first-pass (line 8138) and multi-turn (line 8552) `db_write_fix` handlers have:
- No write throttle (unlimited writes per turn)
- No query length cap
- No multi-statement guard (only destructive pattern block)

**Edge function `db_read_query`** — both handlers (line 8088, 8507) have:
- No query length cap
- No safe serialization cap on results

---

## 5 Changes

### Change 1: Write throttle (`dbWriteCount`)
Add `let dbWriteCount = 0; const MAX_DB_WRITES_PER_TURN = 3;` at line 6893 (before the tool loop). In both `db_write_fix` handlers, check and increment before executing.

### Change 2: Query length cap (4000 chars)
Add length validation to both `db_read_query` and `db_write_fix` handlers (all 4 locations). Reject queries exceeding 4000 characters.

### Change 3: Multi-statement guard on `db_write_fix`
Strip comments, split on semicolons, reject if more than 1 non-empty statement. Applied to both first-pass and multi-turn handlers.

### Change 4: Safe serialization cap on `db_read_query` results
After slicing to 50 rows, check if `JSON.stringify(rows).length > 8000`. If so, progressively reduce to 30 then 10 rows. Applied to all 4 result-push sites in both handlers.

### Change 5: Database migration for `execute_write_fix`
Add server-side defense-in-depth: statement-count guard and length cap inside the function itself.

---

## File Changes

### `supabase/functions/ai-agent/index.ts`

**Line 6893** — Add throttle variables:
```typescript
const seoToolResults: { id: string; name: string; result: any }[] = [];
let dbWriteCount = 0;
const MAX_DB_WRITES_PER_TURN = 3;
```

**Lines 8092-8093 (first-pass db_read_query)** — Add length cap:
```typescript
const query = (args.query || "").trim();
if (query.length > 4000) {
  seoToolResults.push({ id: tc.id, name: "db_read_query", result: { error: "Query exceeds 4000 character limit." } });
} else {
  // existing validation continues...
}
```

**Lines 8128-8129 and 8119-8120 (first-pass db_read_query results)** — Add safe serialization:
```typescript
const rows = Array.isArray(data) ? data.slice(0, 50) : data;
const serialized = JSON.stringify(rows);
const safeRows = serialized.length > 8000
  ? (Array.isArray(data) ? data.slice(0, 10) : data)
  : rows;
```

**Lines 8139-8192 (first-pass db_write_fix)** — Add throttle + length cap + multi-statement guard:
```typescript
if (tc.function?.name === "db_write_fix") {
  try {
    const args = JSON.parse(tc.function.arguments || "{}");
    const query = (args.query || "").trim();
    const reason = args.reason || "No reason provided";
    const confirm = args.confirm === true;

    if (dbWriteCount >= MAX_DB_WRITES_PER_TURN) {
      seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: `Write throttle: max ${MAX_DB_WRITES_PER_TURN} writes per turn reached.` } });
    } else if (query.length > 4000) {
      seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: "Query exceeds 4000 character limit." } });
    } else if (!confirm) {
      // existing confirm check...
    } else {
      // multi-statement guard
      const stmts = query.replace(/--[^\n]*/g, "").split(";").filter(s => s.trim().length > 0);
      if (stmts.length > 1) {
        seoToolResults.push({ id: tc.id, name: "db_write_fix", result: { error: "Only single SQL statements allowed." } });
      } else {
        // existing destructive check + execute...
        dbWriteCount++;
      }
    }
  } catch (e) { ... }
}
```

Same pattern applied to the **multi-turn db_read_query** (lines 8507-8550) and **multi-turn db_write_fix** (lines 8552-8590).

### Database Migration

```sql
CREATE OR REPLACE FUNCTION public.execute_write_fix(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  affected_rows integer;
  stmt_count integer;
BEGIN
  SELECT COUNT(*) INTO stmt_count
  FROM regexp_split_to_table(regexp_replace(sql_query, '--[^\n]*', '', 'g'), ';') s
  WHERE trim(s) != '';

  IF stmt_count > 1 THEN
    RETURN jsonb_build_object('error', 'Only single SQL statements allowed');
  END IF;

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

## Regression Prevention

- Write throttle caps at 3 writes per conversation turn (resets per request)
- Query length cap prevents oversized SQL at both edge function and database level
- Multi-statement guard at both edge function and database level (defense-in-depth)
- Safe serialization prevents LLM context overflow from large query results
- All writes remain audit-logged to `activity_events`

## What Does NOT Change

- No UI changes
- No schema changes to existing tables
- No changes to other agents
- `db_read_query` RPC function unchanged (read-only, lower risk)
- Multi-turn loop logic unchanged
- Admin route guard unchanged

