

# QA War Simulation Round 11 -- Order Lifecycle, Realtime Scoping, Multi-Tenant Audit

---

## Active Bugs Found

---

## BUG R11-1 -- HIGH: `CoordinationDashboard` queries 3 tables without `company_id` filter

**File**: `src/components/estimation/CoordinationDashboard.tsx`

Three queries fetch data globally with no tenant scoping:

1. **Line 24-28**: `project_coordination_log` -- fetches ALL coordination logs across all companies
2. **Line 37-41**: `ingestion_progress` -- fetches ALL ingestion progress rows
3. **Line 50-54**: `estimation_learnings` -- fetches ALL learning pairs

**Impact**: In a multi-tenant deployment, users see coordination data, ingestion progress, and learning stats from other companies. The KPI cards (accuracy, learning pairs count, weight delta) reflect all tenants' data, not just the current user's company.

**Fix**: Import `useCompanyId` and add `.eq("company_id", companyId)` to all 3 queries. Add `enabled: !!companyId` to prevent queries firing before company is resolved.

**Severity**: HIGH -- cross-tenant data exposure in the Learning Engine dashboard.

---

## BUG R11-2 -- MEDIUM: Order status transitions have no validation

**File**: `src/hooks/useOrders.ts` line 126-134

```typescript
const updateOrderStatus = useMutation({
  mutationFn: async ({ id, status }: { id: string; status: string }) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
  },
});
```

Any status can be set to any other status without validation. A user can move an order directly from "draft" to "delivered", bypassing the shop drawing approval, QC, production, and invoicing steps. While the `block_production_without_approval` trigger protects `cut_plan_items`, the order-level status itself has no guard.

**Fix**: Add a client-side status transition map that validates allowed transitions before calling the mutation. This is a defense-in-depth measure (the DB triggers catch production-level violations, but order-level status skipping is unprotected).

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["loading", "cancelled"],
  loading: ["in-transit"],
  "in-transit": ["delivered"],
  delivered: ["invoiced"],
  invoiced: ["paid"],
};
```

**Severity**: MEDIUM -- workflow integrity issue, mitigated by DB triggers for production.

---

## BUG R11-3 -- LOW: 4 realtime channels missing `company_id` filter (R8-6 carried forward)

**Files**:
- `src/hooks/usePennyQueue.ts` line 67 -- `penny_collection_queue`
- `src/hooks/useExtractSessions.ts` line 31 -- `extract_sessions`
- `src/components/support/SupportConversationList.tsx` line 63 -- `support_conversations`
- `src/hooks/useRCPresence.ts` line 60 -- `rc_presence`

All 4 channels listen to ALL rows in their respective tables. While RLS prevents data leakage on the subsequent refetch query, the channel fires unnecessary callbacks for other tenants' changes, causing wasted API calls.

**Fix**: Add `filter: "company_id=eq.<companyId>"` to the `postgres_changes` subscription config for each channel. This requires threading `companyId` into each hook.

For `usePennyQueue` and `useExtractSessions`, import `useCompanyId` and pass it into the subscription filter. For `SupportConversationList`, the component already has access to company context. For `useRCPresence`, the `rc_presence` table may not have a `company_id` column -- need to verify.

**Severity**: LOW -- performance waste, no data leak (RLS protects reads).

---

## Positive Findings (No Bug)

- **Webhook idempotency**: `ringcentral-webhook` uses `dedupe_key` on `activity_events` + `onConflict: "source,source_id"` on `communications`. Solid.
- **QuickBooks invoice idempotency**: `quickbooks-oauth` checks `quickbooks_invoice_id` before creating invoice (line 1114-1128). Double-click safe.
- **Order delete**: No order delete path exists in the frontend -- orders are status-managed, not deletable. Good design.
- **`timeclock-alerts` and `notify-on-message`**: Already do two-step company filtering (global role query + profile company filter). Matches R9-5 pattern.
- **All RESTRICT FKs eliminated**: Confirmed zero remaining from R9-2 migration.

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R11-1 | HIGH | Learning Engine | CoordinationDashboard 3 queries missing company_id | New |
| R11-2 | MEDIUM | Orders | No status transition validation | New |
| R11-3 | LOW | Realtime | 4 channels missing company_id filter (R8-6) | Carried forward |

---

## Implementation Plan

### Step 1: Fix R11-1 (HIGH) -- CoordinationDashboard multi-tenant scoping
- Import `useCompanyId` hook
- Add `.eq("company_id", companyId!)` to `project_coordination_log`, `ingestion_progress`, and `estimation_learnings` queries
- Add `enabled: !!companyId` to all 3 queries

### Step 2: Fix R11-2 (MEDIUM) -- Order status transition validation
- Add `ALLOWED_TRANSITIONS` map to `useOrders.ts`
- In `updateOrderStatus`, validate `currentStatus -> newStatus` before executing the DB update
- Show toast error if transition is not allowed

### Step 3: Fix R11-3 (LOW) -- Realtime channel scoping
- Add `filter: "company_id=eq.{companyId}"` to `usePennyQueue`, `useExtractSessions`, `SupportConversationList`
- For `useRCPresence`, verify if `rc_presence` has a `company_id` column first; if not, skip (RLS handles it)

### Do NOT touch:
- `ringcentral-webhook/index.ts` (idempotency already solid)
- `quickbooks-oauth/index.ts` (invoice guard already solid)
- `useOrders.ts` delete paths (none exist, by design)
- Any files fixed in R7-R10

---

## Updated Technical Debt Score: 1.8/10

| Category | Score | Delta from R10 |
|----------|-------|----------------|
| Security (XSS) | 9/10 | unchanged |
| Multi-tenant isolation | 7/10 | -1 (CoordinationDashboard leak) |
| Data integrity | 8/10 | unchanged |
| Concurrency safety | 8/10 | +1 (QB invoice idempotency confirmed) |
| API contract accuracy | 8/10 | +2 (R8/R9 fixes holding) |
| Workflow integrity | 6/10 | NEW (order status transitions unvalidated) |
| Code quality | 8/10 | unchanged |

