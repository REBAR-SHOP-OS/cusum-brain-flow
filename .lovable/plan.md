

# QA War Simulation Round 9 -- Cross-Module Integrity Audit

## Active Bugs Found (From Live Database Logs + Code Analysis)

---

## BUG R9-1 -- CRITICAL: `ai-agent` queries `user_roles.company_id` which does not exist

**Evidence**: Postgres error log (actively firing):
```
column user_roles.company_id does not exist
```

**Root Cause**: `supabase/functions/ai-agent/index.ts` line 366:
```typescript
const { data: rolesData } = await svcClient
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .eq("company_id", companyId);  // ← COLUMN DOES NOT EXIST
```

The `user_roles` table has columns: `id`, `user_id`, `role`, `created_at`. There is no `company_id` column. This means **every AI agent call fails to load user roles**, causing the agent to operate with an empty `roles` array. This breaks role-gated agent behavior (e.g., shop floor agents should only respond to workshop users, accounting agents to accounting users).

**Fix**: Remove the `.eq("company_id", companyId)` filter:
```typescript
const { data: rolesData } = await svcClient
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id);
```

**Severity**: CRITICAL -- breaks AI agent role awareness on every single call.

---

## BUG R9-2 -- HIGH: Lead delete fails silently due to RESTRICT FK constraints

**Evidence**: Database FK analysis shows 4 child tables with `NO ACTION` (RESTRICT) delete rules:
- `barlists.lead_id` → RESTRICT
- `communications.lead_id` → RESTRICT
- `estimation_learnings.lead_id` → RESTRICT
- `project_coordination_log.lead_id` → RESTRICT

**Root Cause**: `src/pages/Pipeline.tsx` line 267:
```typescript
const { error } = await supabase.from("leads").delete().eq("id", id);
```

No pre-delete cleanup of child records. If a lead has linked barlists, communications, estimation learnings, or coordination logs, the delete will throw a FK violation error. The UI shows "Error deleting lead" but gives no actionable information about what's blocking it.

While `lead_activities`, `lead_communications`, `lead_events`, etc. have CASCADE, the above 4 tables do not.

**Fix**: Before deleting a lead, either:
1. SET NULL on the RESTRICT FK columns (`barlists.lead_id`, `communications.lead_id`, `estimation_learnings.lead_id`, `project_coordination_log.lead_id`), or
2. Delete/nullify child records first, or
3. Change the FK constraints to SET NULL via migration

The cleanest approach is a migration to change the 4 RESTRICT FKs to `SET NULL` since these child records are valid standalone (a barlist can exist without a lead, communications can be orphaned).

**Severity**: HIGH -- users cannot delete leads that have been actively worked on.

---

## BUG R9-3 -- MEDIUM: UUID "null" string error persists (R8-5 fix incomplete)

**Evidence**: Postgres logs still show `invalid input syntax for type uuid: "null"` every ~10 seconds despite the R8-5 fix to `ringcentral-active-calls`.

**Root Cause**: The R8-5 fix added a guard in the edge function, but the error is actually coming from a **client-side query**, not the edge function. The `ActiveCallsPanel` calls `supabase.functions.invoke()` which doesn't hit Postgres directly. The UUID error is from a different client-side `.eq()` call on a table with a UUID column, triggered on the same polling cadence.

The most likely source is an RLS policy evaluation. When the user's session is active and polling, RLS policies that reference `auth.uid()` or join to `profiles.company_id` may receive a null value during edge cases (e.g., stale session, token refresh window). The error fires from the `authenticator` role connection, confirming it's a client-side PostgREST query, not an edge function.

**Fix**: Audit all client-side queries that run on intervals or on page load that pass a variable which could be the string `"null"`. Search for patterns like `.eq("some_uuid_col", someVar)` where `someVar` may not be validated. Add guards: `if (!id) return;`

**Severity**: MEDIUM -- log noise, potential silent data fetch failures.

---

## BUG R9-4 -- MEDIUM: Task delete does not clean up `task_comments`

**File**: `src/pages/Tasks.tsx` line 773:
```typescript
const { error } = await supabase.from("tasks").delete().eq("id", taskId);
```

And the inline version at line 1399. Neither deletes `task_comments` first. If `task_comments.task_id` has a RESTRICT FK, the delete will fail. Even if it has CASCADE, the behavior is inconsistent with the explicit `deleteComment` function on line 490 which handles individual comment deletion. There's also a second delete path in the drawer (line 1399) that duplicates logic without cleanup.

**Fix**: Add `await supabase.from("task_comments").delete().eq("task_id", taskId)` before the task delete, matching the cascade-safe pattern from R7.

**Severity**: MEDIUM -- task deletion may fail for tasks with comments.

---

## BUG R9-5 -- LOW: `pipeline-automation-engine` queries `user_roles` by role without company scoping

**File**: `supabase/functions/pipeline-automation-engine/index.ts` line 140-143:
```typescript
const { data: users } = await supabase
  .from("user_roles")
  .select("user_id")
  .in("role", roles);
```

This fetches ALL users with matching roles across ALL companies. In a multi-tenant environment, automation tasks could be assigned to users from different companies. The same pattern exists in:
- `daily-team-report/index.ts` line 192-195
- `timeclock-alerts/index.ts` line 144-147
- `pipeline-digest/index.ts` line 116-119
- `notify-on-message/index.ts` line 169-172
- `auto-generate-post/index.ts` line 315-318

Since `user_roles` has no `company_id`, these functions need to join through `profiles` to filter by company.

**Fix**: Join through profiles:
```typescript
const { data: users } = await supabase
  .from("profiles")
  .select("user_id, user_roles!inner(role)")
  .eq("company_id", companyId)
  .in("user_roles.role", roles);
```

Or add a `company_id` column to `user_roles` (but this is a larger schema change).

**Severity**: LOW in single-tenant deployment, HIGH in multi-tenant -- cross-company notification leakage.

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R9-1 | CRITICAL | AI Agent | `user_roles.company_id` column doesn't exist, breaks role loading | Active, every agent call |
| R9-2 | HIGH | Pipeline | Lead delete blocked by RESTRICT FKs on 4 child tables | Latent, fails on worked leads |
| R9-3 | MEDIUM | System | UUID "null" error persists from client-side query (R8-5 was server-side only) | Active, every 10s |
| R9-4 | MEDIUM | Tasks | Task delete skips child comment cleanup | Latent |
| R9-5 | LOW/HIGH | Multi-tenant | 6 edge functions query user_roles without company scoping | Latent in single-tenant |

---

## Recurring Pattern Summary

1. **Schema assumption drift**: Code assumes columns exist that don't (`user_roles.company_id` in R9-1, `leads.expected_revenue` in R8-2). No compile-time safety for edge functions.
2. **Delete without cascade audit**: Rounds 7, 8, 9 keep finding new delete paths that skip child records. Systematic FK audit needed.
3. **Cross-tenant role queries**: `user_roles` lacks `company_id`, forcing all role-based lookups to be global. 6+ edge functions affected.

---

## Implementation Plan

### Step 1: Fix R9-1 (CRITICAL) -- AI agent role query
- Remove `.eq("company_id", companyId)` from `supabase/functions/ai-agent/index.ts` line 366
- Deploy `ai-agent` edge function

### Step 2: Fix R9-2 (HIGH) -- Lead delete FK constraints
- Database migration to change 4 RESTRICT FKs to SET NULL:
  - `barlists.lead_id` → SET NULL
  - `communications.lead_id` → SET NULL
  - `estimation_learnings.lead_id` → SET NULL
  - `project_coordination_log.lead_id` → SET NULL

### Step 3: Fix R9-4 (MEDIUM) -- Task delete cleanup
- Add `task_comments` deletion before task deletion in `src/pages/Tasks.tsx` (both delete paths)

### Step 4: Fix R9-5 (LOW) -- Cross-tenant role queries
- Update `pipeline-automation-engine`, `daily-team-report`, `timeclock-alerts`, `pipeline-digest`, `notify-on-message`, and `auto-generate-post` to join through `profiles` for company-scoped role lookups

### Do NOT touch:
- `ringcentral-active-calls/index.ts` (R8-5 fix is correct server-side, R9-3 is client-side)
- `CutterStationView.tsx`, `BenderStationView.tsx` (fixed in R7/R8)
- `Customers.tsx`, `AccountingCustomers.tsx` (fixed in R7)
- `search-embeddings/index.ts`, `agentExecutiveContext.ts` (fixed in R8)

---

## Updated Technical Debt Score: 2.5/10

| Category | Score | Delta from R8 |
|----------|-------|---------------|
| Security (XSS) | 9/10 | unchanged |
| Multi-tenant isolation | 6/10 | -2 (6 functions with global role queries) |
| Data integrity | 7/10 | -1 (lead delete + task delete gaps) |
| Concurrency safety | 7/10 | +2 (R7/R8 atomic RPCs holding) |
| API contract accuracy | 6/10 | -2 (user_roles.company_id ghost column) |
| Code quality | 8/10 | unchanged |

