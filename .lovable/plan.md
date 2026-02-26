

# QA War Simulation Round 15 -- Lead Lifecycle, Quote Conversion, Customer Safety, Payroll Integrity

---

## BUG R15-1 -- HIGH: Lead delete has no child-record guard

**File**: `src/pages/Pipeline.tsx` line 267

The lead delete mutation is a raw `supabase.from("leads").delete().eq("id", id)` with zero pre-checks. Unlike the customer delete (which deletes child contacts first) or the delivery delete (which cleans up stops/slips), leads can have:
- `quotes` with `lead_id` FK
- `lead_activities` with `lead_id` FK
- `lead_events` with `lead_id` FK
- `lead_files` referencing the lead

If a lead has linked quotes or orders, deleting it either:
1. Fails silently with an FK violation (user sees "Error deleting lead")
2. Or succeeds and orphans all downstream records

**No confirmation dialog** asks "This lead has 3 quotes and 1 order -- are you sure?"

**Impact**: HIGH -- data orphaning or silent failure. A lead with active quotes/orders should never be deletable.

**Fix**:
1. Before delete, query `quotes` and `orders` for this lead's ID
2. If any exist, block deletion with a toast: "Cannot delete: lead has linked quotes/orders"
3. Add a DB trigger `block_lead_delete_with_children` as defense-in-depth

---

## BUG R15-2 -- HIGH: Customer delete orphans orders, quotes, invoices

**File**: `src/pages/Customers.tsx` lines 208-213

The customer delete only cleans up `contacts` before deleting the customer. It does not check for:
- `orders` with `customer_id` FK
- `quotes` with `customer_id` FK
- `leads` with `customer_id` FK
- `deliveries` referencing orders for this customer

If FK constraints are set to RESTRICT (likely), the delete will fail with a cryptic DB error. If set to CASCADE (unlikely but dangerous), it would cascade-delete all orders, quotes, and financial records.

**Impact**: HIGH -- either data loss (CASCADE) or confusing error (RESTRICT). No business logic guards.

**Fix**:
1. Before delete, check for orders/quotes/leads referencing this customer
2. If any exist, block with clear message: "Cannot delete customer with active orders"
3. Add a DB trigger `block_customer_delete_with_orders` as server-side guard

---

## BUG R15-3 -- MEDIUM: Quote-to-order conversion has no quote status guard

**File**: `supabase/functions/convert-quote-to-order/index.ts` line 71

The conversion function checks for duplicate orders (line 74-84, good dedup), but it does NOT check the quote's status. A draft, expired, or rejected quote can be converted to an order. The only check is `if (qErr || !quote) throw new Error("Quote not found")`.

**Flow**:
1. Sales creates quote, status = "draft"
2. Customer rejects it, status updated to "rejected"
3. Another user (or AI agent via `agentToolExecutor`) calls `convert-quote-to-order` with the rejected quote's ID
4. Order is created from a rejected quote -- financial and workflow inconsistency

**Impact**: MEDIUM -- orders created from invalid quotes corrupt the sales pipeline.

**Fix**:
Add status validation after fetching the quote:
```typescript
const CONVERTIBLE_STATUSES = ["approved", "accepted", "sent", "signed"];
if (!CONVERTIBLE_STATUSES.includes(quote.status)) {
  return json({ error: `Cannot convert quote in status: ${quote.status}` }, 400);
}
```

---

## BUG R15-4 -- MEDIUM: Payroll engine uses deprecated AI model name

**File**: `supabase/functions/payroll-engine/index.ts` lines 202-214

The payroll engine calls `callAI()` with `model: "gpt-4o-mini"`. This model identifier is not in the Lovable AI supported models list. The supported equivalent is `openai/gpt-5-nano` or `google/gemini-2.5-flash-lite`. If the AI router doesn't map this legacy name, the call will fail silently (the error is caught on line 226 as non-fatal), producing payroll snapshots with no AI audit notes.

Additionally, the `provider: "gpt"` parameter may not match the current `callAI` router expectations.

**Impact**: MEDIUM -- payroll AI notes silently missing. No user-visible error but auditing quality degrades.

**Fix**:
Update to a supported model:
```typescript
const aiResult = await callAI({
  model: "google/gemini-2.5-flash-lite",
  messages: [...],
  temperature: 0.3,
});
```

---

## BUG R15-5 -- LOW: Pipeline lead stage update has no optimistic locking

**File**: `src/pages/Pipeline.tsx` line 244

The stage update is `supabase.from("leads").update({ stage }).eq("id", id)` with no concurrency guard. If two users (or a user + an AI agent like the pipeline-automation-engine) update the same lead's stage simultaneously:
1. User A drags lead from "new" to "qualified"
2. AI automation moves same lead from "new" to "estimation"
3. Last write wins -- no conflict detection, no error, audit log records both as "allowed"

The `logPipelineTransition` captures `fromStage` from the local React state, not from the DB. So the audit log may record a transition `new → qualified` even though the DB already moved to `estimation`.

**Impact**: LOW -- rare in practice, but the audit trail becomes unreliable.

**Fix**:
Add an optimistic lock: `.eq("stage", fromStage)` to the update, and check if 0 rows were affected (meaning someone else changed it):
```typescript
const { data, error } = await supabase
  .from("leads")
  .update({ stage })
  .eq("id", id)
  .eq("stage", fromStage)  // optimistic lock
  .select("id")
  .maybeSingle();
if (!data && !error) throw new Error("Lead was modified by another user");
```

---

## Positive Findings (No Bug)

- **Quote-to-order dedup**: `convert-quote-to-order` checks for existing orders with same `quote_id` (line 74-84). Solid idempotency with 409 response.
- **Order number retry loop**: 5-attempt retry with sequence increment handles concurrent conversions (lines 89-157).
- **Machine run Zod validation**: `log-machine-run` validates all fields with Zod including `.nonnegative()` on quantities and `.uuid()` on IDs.
- **Smart dispatch role check**: `smart-dispatch` correctly blocks non-workshop/admin users from dispatch actions.
- **Payroll overtime calc**: Correctly distributes overtime from the last day backwards after 44h/week threshold (Ontario ESA compliant).

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R15-1 | HIGH | Pipeline | Lead delete has no child-record guard (quotes/orders orphaned) | New |
| R15-2 | HIGH | Customers | Customer delete orphans orders/quotes/invoices | New |
| R15-3 | MEDIUM | Quotes/Orders | Quote-to-order conversion allows draft/rejected/expired quotes | New |
| R15-4 | MEDIUM | Payroll | AI model name `gpt-4o-mini` deprecated, notes silently missing | New |
| R15-5 | LOW | Pipeline | No optimistic locking on lead stage update, audit trail unreliable | New |

---

## Implementation Plan

### Step 1: Fix R15-1 (HIGH) -- Lead delete child guard

In `src/pages/Pipeline.tsx`, before the `.delete()` call:
```typescript
// Check for linked quotes/orders
const { count: quoteCount } = await supabase
  .from("quotes").select("id", { count: "exact", head: true }).eq("lead_id", id);
const { count: orderCount } = await supabase
  .from("orders").select("id", { count: "exact", head: true })
  .in("quote_id", /* quotes for this lead */);
if ((quoteCount || 0) > 0) throw new Error("Cannot delete lead with linked quotes");
```
Also clean up `lead_activities` and `lead_files` before delete (like the task delete pattern).

### Step 2: Fix R15-2 (HIGH) -- Customer delete safety

In `src/pages/Customers.tsx`, add pre-delete checks:
```typescript
const { count: orderCount } = await supabase
  .from("orders").select("id", { count: "exact", head: true }).eq("customer_id", id);
if ((orderCount || 0) > 0) throw new Error("Cannot delete customer with active orders");
```
DB trigger `block_customer_delete_with_orders` as server-side backup.

### Step 3: Fix R15-3 (MEDIUM) -- Quote status guard

In `supabase/functions/convert-quote-to-order/index.ts`, after line 71:
```typescript
const CONVERTIBLE = ["approved", "accepted", "sent", "signed"];
if (!CONVERTIBLE.includes(quote.status)) {
  return new Response(JSON.stringify({ error: `Cannot convert quote in status: ${quote.status}` }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

### Step 4: Fix R15-4 (MEDIUM) -- Payroll AI model update

In `supabase/functions/payroll-engine/index.ts` line 203-204, replace:
```typescript
provider: "gpt",
model: "gpt-4o-mini",
```
with:
```typescript
model: "google/gemini-2.5-flash-lite",
```

### Step 5: Fix R15-5 (LOW) -- Pipeline optimistic lock

In `src/pages/Pipeline.tsx` line 244, add `.eq("stage", fromStage)` to the update query and handle the conflict case with a toast + refetch.

### Do NOT touch:
- `convert-quote-to-order` dedup logic (correct)
- `log-machine-run` Zod validation (correct)
- `smart-dispatch` role checks (correct)
- Payroll overtime distribution (correct)
- Any R7-R14 fixes

---

## Cumulative Technical Debt Score: 1.1/10

| Category | Score | Delta |
|----------|-------|-------|
| Multi-tenant isolation | 9/10 | unchanged |
| Workflow integrity | 8/10 | +1 (R14 delivery transitions deployed) |
| Financial controls | 7/10 | unchanged |
| Data integrity | 7/10 | -2 (lead/customer delete orphaning) |
| Inventory accuracy | 8/10 | +2 (R14 over-consumption guard deployed) |
| Notification reliability | 8.5/10 | +0.5 (push failure logging deployed) |
| Pipeline reliability | 8/10 | NEW (no optimistic lock, no delete guard) |

