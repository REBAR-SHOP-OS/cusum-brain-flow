

# Audit and Fix: Architect Agent Multi-Turn Tool Loop

## Problem Found

The Architect agent says "I couldn't process that request" because of a critical code duplication gap in the multi-turn tool loop.

The edge function has TWO sections that handle tool calls:
1. **First-pass handlers** (lines 8088-8191) -- handles `db_read_query` and `db_write_fix` correctly
2. **Multi-turn loop handlers** (lines 8315-8503) -- these tools are MISSING here

When the agent receives an autofix task, it typically:
- Turn 1: calls `read_task` (works -- handled in both sections)
- Turn 2: calls `db_read_query` (FAILS -- not in multi-turn loop, gets generic `{success: true, message: "Processed"}` with no data)
- Turn 3: model gets confused by empty result, gives up

This is why you see "Okay, I'm on it..." followed by "I couldn't process that request."

## Additional Issues Found

1. **False-positive write detection**: The regex that blocks write keywords in `db_read_query` can reject legitimate queries like `SELECT * FROM pg_policies` because the `pg_policies` view contains column names like `cmd` with values `INSERT`/`UPDATE` in the query text context.

2. **Missing tools in handledNames**: `db_read_query`, `db_write_fix`, `odoo_write`, `wp_update_product`, `diagnose_from_screenshot`, `generate_patch`, `validate_code` are not in the `handledNames` array, causing them to receive duplicate generic results.

## Solution (Surgical)

### File: `supabase/functions/ai-agent/index.ts`

**Change 1**: Add `db_read_query` and `db_write_fix` handlers inside the multi-turn loop (after `list_fix_tickets` handler, before the `handledNames` check). These will be exact copies of the first-pass handlers.

**Change 2**: Add all missing tool names to the `handledNames` array at line 8500 to prevent duplicate generic results.

**Change 3**: Fix the `dangerousWrite` regex guard to only flag queries that CONTAIN actual write statements (not just mention write keywords in string literals or column references). Change the check to exclude the query from the `SELECT` clause and only test the top-level statement structure.

## What This Fixes

- Agent will successfully execute `db_read_query` in turns 2-5 of the multi-turn loop
- Agent will successfully execute `db_write_fix` in turns 2-5
- No more "I couldn't process that request" for autofix tasks that need database investigation
- Legitimate `pg_policies` inspection queries won't be falsely blocked

## What This Does NOT Touch

- No UI changes
- No database changes
- No changes to any other agent or module
- First-pass handlers remain unchanged
- All existing tool handlers preserved

## Technical Details

### Multi-turn loop additions (inside `for (const tc of newToolCalls)` block):

```typescript
// db_read_query (multi-turn)
if (tc.function?.name === "db_read_query") {
  // Exact same handler as first-pass (lines 8089-8134)
}

// db_write_fix (multi-turn)  
if (tc.function?.name === "db_write_fix") {
  // Exact same handler as first-pass (lines 8138-8191)
}
```

### Updated handledNames:

```typescript
const handledNames = [
  "send_email", "read_task", "resolve_task",
  "update_machine_status", "update_delivery_status",
  "update_lead_status", "update_cut_plan_status",
  "create_event", "create_notifications",
  "create_fix_ticket", "update_fix_ticket", "list_fix_tickets",
  "db_read_query", "db_write_fix",
  "odoo_write", "wp_update_product", "wp_list_posts", "wp_create_post",
  "diagnose_from_screenshot", "generate_patch", "validate_code",
];
```

### Fixed dangerousWrite guard:

```typescript
// Only block if the TOP-LEVEL statement is a write operation
// Don't flag SELECT queries that merely reference write keywords in filters/strings
const upperQuery = query.toUpperCase().replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").trim();
if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("WITH")) {
  // Already blocked above
} 
// For SELECT/WITH queries, only block if there's a semicolon followed by a write statement
const hasMultiStatement = /;\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i.test(query);
if (hasMultiStatement) {
  seoToolResults.push({ id: tc.id, name: "db_read_query", result: { error: "Multi-statement write detected." } });
}
```
