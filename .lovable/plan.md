

# QA War Simulation Round 8 -- Deep System Audit

## Active Bugs Found (From Live Database Logs + Code Analysis)

---

## BUG R8-1 -- CRITICAL: `match_documents` RPC signature mismatch (actively failing)

**Evidence**: Edge function logs show this error every time `search-embeddings` is called:
```
Could not find the function public.match_documents(filter_company, filter_domain, match_count, match_threshold, query_embedding) in the schema cache
```

**Root Cause**: The database RPC `match_documents` accepts 3 parameters:
```
(query_embedding vector, match_count integer, filter_company_id uuid)
```

But `supabase/functions/search-embeddings/index.ts` (line 52-58) calls it with 5 parameters:
```typescript
supabase.rpc("match_documents", {
  query_embedding: ...,
  match_count: matchCount || 5,
  match_threshold: threshold || 0.5,     // DOES NOT EXIST
  filter_domain: domain || null,          // DOES NOT EXIST
  filter_company: companyId || null,      // WRONG NAME (should be filter_company_id)
});
```

**Impact**: All semantic search / RAG is completely broken. The AI agent's knowledge retrieval returns zero results, degrading AI quality across the platform.

**Fix**: Update the RPC call to match the actual function signature:
```typescript
supabase.rpc("match_documents", {
  query_embedding: `[${queryEmbedding.join(",")}]`,
  match_count: matchCount || 5,
  filter_company_id: companyId || null,
});
```
If `match_threshold` and `filter_domain` filtering are needed, the database function must be updated to accept those additional parameters.

**Severity**: CRITICAL -- breaks RAG/knowledge retrieval system-wide.

---

## BUG R8-2 -- HIGH: `agentExecutiveContext.ts` queries non-existent column `expected_revenue`

**Evidence**: Postgres error log:
```
column leads.expected_revenue does not exist
```

**Root Cause**: `supabase/functions/_shared/agentExecutiveContext.ts` line 44:
```typescript
.select("id, expected_revenue, status, stage, lead_score")
```

The actual column name is `expected_value` (confirmed via schema query). The Odoo sync functions use `expected_revenue` as an Odoo field name and correctly map it to `expected_value` when writing to the DB, but this context builder reads the wrong column name.

**Impact**: The AI executive briefing / Empire builder agent gets no pipeline value data, producing incomplete or incorrect financial summaries for the CEO dashboard AI.

**Fix**: Change `expected_revenue` to `expected_value` on line 44.

**Severity**: HIGH -- breaks AI executive context for pipeline value calculations.

---

## BUG R8-3 -- HIGH: `BenderStationView` uses absolute writes for `bend_completed_pieces`

**File**: `src/components/shopfloor/BenderStationView.tsx` line 107

The CutterStationView was fixed in Round 7 to use the atomic `increment_completed_pieces` RPC. However, BenderStationView still uses absolute writes:
```typescript
.update({ bend_completed_pieces: newCount } as any)
```

Two bender operators working the same item will overwrite each other's progress. The `as any` cast also bypasses TypeScript type checking entirely.

**Fix**: Either:
1. Create an `increment_bend_completed_pieces` RPC (mirrors the cutting RPC pattern), or
2. Extend the existing `increment_completed_pieces` to accept a `p_column` parameter for which column to increment.

**Severity**: HIGH -- data corruption under concurrent bender operation.

---

## BUG R8-4 -- MEDIUM: `CapacityDrawer` forwardRef warning

**Evidence**: Console warning:
```
Function components cannot be given refs. Check the render method of CapacityDrawer.
```

**Root Cause**: `CapacityDrawer` uses `<Sheet>` which internally renders a `<Dialog>` that attempts to pass a ref. The component itself is a function component, not wrapped in `React.forwardRef`. While Radix handles this gracefully at runtime, the warning pollutes the console and indicates a potential issue with newer Radix versions.

**Fix**: Wrap `CapacityDrawer` with `React.forwardRef` or ensure the Sheet/Dialog wrapper handles the ref correctly.

**Severity**: LOW -- cosmetic console warning, no runtime impact.

---

## BUG R8-5 -- MEDIUM: Recurring `invalid input syntax for type uuid: "null"` (every 10 seconds)

**Evidence**: Postgres error logs show this error repeating every ~10 seconds, matching the `ringcentral-active-calls` polling interval visible in the session replay ("Loading..." → "No active calls" cycle).

**Root Cause**: Somewhere in the active calls or related polling flow, the JavaScript string `"null"` is being passed where a UUID is expected, instead of SQL `NULL`. This is likely from a `.eq("column", someVariable)` call where `someVariable` holds the string `"null"` rather than `null`.

**Impact**: Noisy error logs obscuring real issues. May cause subtle data fetch failures.

**Fix**: Audit all `.eq()` calls in the ringcentral and polling hooks for null-safety. Add guard: `if (!id || id === "null") return;`

**Severity**: MEDIUM -- no data corruption but creates log noise and potential silent failures.

---

## BUG R8-6 -- LOW: Realtime channels not scoped by `company_id`

Four realtime subscriptions use `Math.random()` for uniqueness but do not filter by `company_id` in the postgres_changes filter:

- `usePennyQueue.ts` line 66 -- listens to ALL `penny_collection_queue` changes
- `useExtractSessions.ts` line 28 -- listens to ALL `extract_sessions` changes
- `SupportConversationList.tsx` line 62 -- listens to ALL `support_conversations` changes
- `useRCPresence.ts` line 59 -- listens to ALL `rc_presence` changes

While RLS prevents data leakage on the query side, the realtime channel will fire unnecessary refetch callbacks for other tenants' changes, causing wasted API calls and potential UI flicker.

**Fix**: Add `filter: "company_id=eq.<companyId>"` to each postgres_changes subscription.

**Severity**: LOW -- performance waste, no data leak (RLS protects reads).

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R8-1 | CRITICAL | Search/RAG | `match_documents` RPC signature mismatch -- 5 params vs 3 | Active, failing every call |
| R8-2 | HIGH | AI Agent | `expected_revenue` column doesn't exist, should be `expected_value` | Active, failing on CEO context |
| R8-3 | HIGH | Shop Floor | BenderStation absolute write concurrency bug (unfixed from R7) | Latent, triggers under concurrent use |
| R8-4 | LOW | CEO Dashboard | CapacityDrawer forwardRef warning | Cosmetic |
| R8-5 | MEDIUM | Phone/Polling | `"null"` string passed as UUID every 10s | Active, log noise |
| R8-6 | LOW | Realtime | 4 channels missing company_id filter | Performance waste |

---

## Recurring Pattern Summary

1. **Column name drift** (R8-2): Odoo uses `expected_revenue`, DB uses `expected_value`. Context builders reference the wrong one.
2. **RPC parameter drift** (R8-1): Database functions evolve (params removed/renamed) but callers are not updated.
3. **Absolute write pattern** (R8-3): Bender station still uses the pre-R7 absolute write pattern. All station views should use atomic RPCs.
4. **String "null" vs null** (R8-5): JavaScript serialization converting `null` to `"null"` string before DB query.

---

## Implementation Plan

### Step 1: Fix R8-1 (CRITICAL) -- Search embeddings RPC call
- Update `supabase/functions/search-embeddings/index.ts` to use correct 3-param signature
- Remove `match_threshold` and `filter_domain` params (or create migration to add them to the DB function)

### Step 2: Fix R8-2 (HIGH) -- Agent executive context column name
- Change `expected_revenue` to `expected_value` in `supabase/functions/_shared/agentExecutiveContext.ts` line 44

### Step 3: Fix R8-3 (HIGH) -- Bender atomic increment
- Create `increment_bend_completed_pieces` RPC (database migration)
- Update `BenderStationView.tsx` to use the new RPC instead of absolute write

### Step 4: Fix R8-5 (MEDIUM) -- UUID null string guard
- Add null-safety guards in the ringcentral polling hooks

### Step 5: Fix R8-6 (LOW) -- Realtime channel scoping
- Add company_id filters to the 4 unscoped realtime channels

### Do NOT touch:
- `CutterStationView.tsx` (already fixed in R7)
- `CampaignReviewPanel.tsx` (already fixed in R7 with DOMPurify)
- `Customers.tsx` / `AccountingCustomers.tsx` (cascade deletes already fixed in R7)
- Any Odoo sync functions (they correctly map `expected_revenue` → `expected_value`)

---

## Updated Technical Debt Score: 2.8/10

| Category | Score | Delta from R7 |
|----------|-------|---------------|
| Security (XSS) | 9/10 | +1 (R7 fix holding) |
| Multi-tenant isolation | 8/10 | -1 (4 unscoped channels) |
| Data integrity | 7/10 | -1 (bender absolute writes + RPC mismatch) |
| Concurrency safety | 5/10 | unchanged |
| API contract accuracy | 4/10 | NEW (RPC + column mismatches) |
| Code quality | 8/10 | unchanged |

