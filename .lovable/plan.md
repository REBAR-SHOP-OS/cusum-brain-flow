

# Upgrade: Architect Diagnostic Intelligence System

## Summary

Upgrade the Empire/Architect agent in `supabase/functions/ai-agent/index.ts` with three core capabilities: error classification taxonomy, execution receipts enforcement, and environment pre-checks. These changes go into the system prompt and the tool execution loop.

---

## Change 1: Error Classification + "Stop Asking Me" Rule (System Prompt)

**File:** `supabase/functions/ai-agent/index.ts` (empire system prompt, ~line 2297-2329)

Add an **Error Classification Taxonomy** section after the existing EXECUTION DISCIPLINE block. This teaches the agent to classify errors instead of narrating them, and to stop after 2 identical clarification requests.

New prompt section to insert after the PLANNING PHASE block (after line 2329):

```text
ERROR CLASSIFICATION (MANDATORY on any tool failure):
When a tool returns an error, you MUST classify it before responding:

| Class               | Meaning                                    | Action               |
|---------------------|--------------------------------------------|----------------------|
| TOOL_BUG            | Tool itself is broken (runtime crash)      | [STOP] + escalate    |
| PERMISSION_MISSING  | RLS/auth blocks the operation              | [READ] pg_policies   |
| CONTEXT_MISSING     | companyId, userId, or PK not available     | [STOP] + request it  |
| USER_INPUT_MISSING  | Need specific ID, name, or description     | [STOP] + ask once    |
| SYNTAX_ERROR        | Bad SQL or malformed query                 | Fix query + retry    |
| DATA_NOT_FOUND      | Query returned 0 rows                      | Report finding       |

Rules:
- TOOL_BUG: STOP immediately. Say "This is a tool implementation bug. Retrying will not help. Escalation required." Do NOT retry.
- If the same error repeats twice, classify as systemic. STOP and report: "Problem is systemic, not user input."
- If you ask the same clarifying question twice, STOP and say: "I cannot proceed due to missing system capability, not missing user input."
- NEVER explain an error without classifying it first.

EXECUTION RECEIPTS (MANDATORY):
You may NOT use the words "I found", "I checked", "I queried", "I verified", "I confirmed" unless you include the tool receipt in the same message:
- Tool name
- Input (query or parameters)
- Output (rows returned, error message, or result)
If no receipt exists, say: "I could not execute the tool."
```

---

## Change 2: Environment Pre-Check Before Writes (Tool Loop)

**File:** `supabase/functions/ai-agent/index.ts` (~line 8359, before the while loop starts)

Add a pre-check that validates critical context before the multi-turn loop begins. If `companyId` is the fallback UUID, log a warning. This prevents silent failures where writes succeed but target the wrong tenant.

```javascript
// Environment sanity check — log warnings for degraded state
if (agent === "empire") {
  const envChecks = {
    companyId_present: !!companyId && companyId !== "a0000000-0000-0000-0000-000000000001",
    companyId_is_fallback: companyId === "a0000000-0000-0000-0000-000000000001",
    userId_present: !!user?.id,
    authHeader_present: !!authHeader,
  };
  if (!envChecks.companyId_present || envChecks.companyId_is_fallback) {
    console.warn("Empire env pre-check: companyId missing or fallback", envChecks);
  }
}
```

---

## Change 3: Enhanced Circuit Breaker with Error Classification (Tool Loop)

**File:** `supabase/functions/ai-agent/index.ts` (~lines 8731-8743)

Upgrade the existing circuit breaker to include error classification in its stop message. Currently it just says "queries failed twice." The upgrade classifies the errors before stopping.

Replace lines 8731-8743 with:

```javascript
// Circuit breaker with error classification
const allFailed = seoToolResults.length > 0 && seoToolResults.every(r => r.result?.error);
if (allFailed) {
  consecutiveToolErrors++;
  if (consecutiveToolErrors >= 2) {
    // Classify the errors
    const classifications = seoToolResults.map(r => {
      const err = String(r.result?.error || "");
      let errorClass = "UNKNOWN";
      if (/not a function|undefined is not|TypeError|Cannot read prop/i.test(err)) errorClass = "TOOL_BUG";
      else if (/permission|denied|RLS|row.level security/i.test(err)) errorClass = "PERMISSION_MISSING";
      else if (/company_id|companyId|user_id|not found.*profile/i.test(err)) errorClass = "CONTEXT_MISSING";
      else if (/syntax|parse|unexpected token|invalid input/i.test(err)) errorClass = "SYNTAX_ERROR";
      else if (/no rows|0 rows|not found/i.test(err)) errorClass = "DATA_NOT_FOUND";
      return `- **${errorClass}**: ${r.name} → ${err.substring(0, 200)}`;
    });
    reply = "[STOP]\n\n**Error Classification:**\n" +
      classifications.join("\n") +
      "\n\nThe problem is systemic, not user input. " +
      (classifications.some(c => c.includes("TOOL_BUG"))
        ? "This is a tool implementation bug. Retrying will not help. Escalation required."
        : "Please provide specific IDs, table names, or rephrase your request.");
    break;
  }
} else {
  consecutiveToolErrors = 0;
}
```

---

## Change 4: Diagnostic Logging on Follow-Up Responses (Tool Loop)

**File:** `supabase/functions/ai-agent/index.ts` (~line 8406, after `followUpData` is parsed)

Add a diagnostic log line so empty-reply scenarios are debuggable:

```javascript
const followUpData = await followUp.json();
const followUpChoice = followUpData.choices?.[0];
console.log(`Multi-turn iter ${toolLoopIterations}: finish_reason=${followUpChoice?.finish_reason}, has_content=${!!followUpChoice?.message?.content}, has_tools=${!!followUpChoice?.message?.tool_calls?.length}`);
```

---

## Change 5: Synthesize Reply from Tool Results When Model Returns Empty (Tool Loop)

**File:** `supabase/functions/ai-agent/index.ts` (~line 8748-8750, the `else` branch for "no more tool calls")

When the model returns no content and no tool calls but we have tool results, synthesize a response instead of silently breaking:

```javascript
} else {
  // No more tool calls — synthesize if reply still empty
  if (!reply || reply.trim() === "") {
    const successResults = seoToolResults.filter(r => !r.result?.error);
    const errorResults = seoToolResults.filter(r => r.result?.error);
    if (successResults.length > 0) {
      const summaries = successResults.map(r => {
        if (r.name === "db_read_query" && r.result?.rows) {
          const rowCount = r.result.row_count || (Array.isArray(r.result.rows) ? r.result.rows.length : 0);
          if (rowCount === 0) return "Query returned no results.";
          return `Query returned ${rowCount} row(s):\n\`\`\`json\n${JSON.stringify(r.result.rows, null, 2).substring(0, 2000)}\n\`\`\``;
        }
        return r.result?.message || JSON.stringify(r.result).substring(0, 500);
      });
      reply = "[READ]\n\nHere are the results:\n\n" + summaries.join("\n\n");
      if (errorResults.length > 0) {
        reply += "\n\nSome operations had errors:\n" + errorResults.map(r => `- ${r.result.error}`).join("\n");
      }
    }
  }
  break;
}
```

---

## Technical Summary

| # | Location | Lines | Change |
|---|----------|-------|--------|
| 1 | Empire system prompt | ~2329 | Add Error Classification Taxonomy + Receipt enforcement |
| 2 | Multi-turn loop setup | ~8359 | Add environment pre-check logging |
| 3 | Circuit breaker | 8731-8743 | Classify errors before stopping |
| 4 | Follow-up response | ~8406 | Add diagnostic logging |
| 5 | No-tool-calls branch | 8748-8750 | Synthesize reply from tool results |

## What This Fixes

- Agent classifies errors as TOOL_BUG/PERMISSION/CONTEXT/SYNTAX/DATA instead of narrating
- TOOL_BUG errors trigger immediate STOP (no retries, no speculation)
- Duplicate clarification questions are blocked ("stop asking me" rule)
- Empty model responses synthesize tool output instead of showing "blocked" banner
- Environment pre-checks catch missing companyId before wasting tool calls
- All changes are in one file with no schema or dependency changes

