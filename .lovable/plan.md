

# Fix: AI App Builder — Semicolon Stripping + Error Circuit Breaker

## Problem

The Architect agent's `db_read_query` tool fails when queries include trailing semicolons (standard LLM habit). The `execute_readonly_query` DB function wraps user SQL in a subquery like `FROM (<user_sql>) t`, so a trailing `;` becomes `FROM (SELECT ...;) t` which is a syntax error. The agent then loops up to 5 times trying to "fix" the syntax, narrating endlessly instead of stopping.

## Changes (1 file, 4 edits)

### 1. Strip trailing semicolons in first-pass handler (line 8167)

Change:
```javascript
const query = (args.query || "").trim();
```
To:
```javascript
const query = (args.query || "").trim().replace(/;+$/, "");
```

### 2. Strip trailing semicolons in multi-turn handler (line 8615)

Same change at the second handler location.

### 3. Add consecutive error circuit breaker (lines 8349-8356)

Add a `consecutiveToolErrors` counter before the while loop. After each iteration's tool results are collected, check if all results were errors. If 2+ consecutive rounds fail, inject a `[STOP]` message and break out of the loop.

```javascript
let consecutiveToolErrors = 0;
```

After tool results are processed in each iteration (around line 8415 where `seoToolResults` is reset), check:

```javascript
const allFailed = seoToolResults.length > 0 && seoToolResults.every(r => r.result?.error);
if (allFailed) {
  consecutiveToolErrors++;
  if (consecutiveToolErrors >= 2) {
    reply = "[STOP]\n\nMy database queries failed twice consecutively. The errors were:\n" +
      seoToolResults.map(r => `- ${r.result.error}`).join("\n") +
      "\n\nPlease help me by rephrasing your request, providing specific table/record names, or describing what you need.";
    break;
  }
} else {
  consecutiveToolErrors = 0;
}
```

### 4. Update tool description to warn about semicolons (line 6689)

Change the `db_read_query` description to include "Do NOT include trailing semicolons":

```
"Run a read-only SQL query against the database. Only SELECT/WITH queries allowed. Do NOT include trailing semicolons. Returns up to 50 rows."
```

## Technical Summary

| Location | Lines | Change |
|----------|-------|--------|
| First-pass `db_read_query` handler | 8167 | Add `.replace(/;+$/, "")` |
| Multi-turn `db_read_query` handler | 8615 | Add `.replace(/;+$/, "")` |
| Multi-turn loop setup | 8349-8356 | Add `consecutiveToolErrors` counter + circuit breaker |
| Tool definition | 6689 | Add semicolon warning to description |

## What This Fixes

- SQL queries with trailing semicolons execute correctly instead of erroring
- Agent stops after 2 consecutive tool failures with a `[STOP]` marker (triggers amber "blocked" banner in UI)
- No more endless narration loops when tools fail
- Tool description guides the LLM away from semicolons proactively

