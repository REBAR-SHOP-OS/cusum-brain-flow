

# QA War Simulation Round 12 -- Order Lifecycle & Transition Integrity

## Active Environment Status
- R9-1 fix confirmed deployed: `user_roles.company_id` errors gone from logs
- Only active Postgres error: `unrecognized configuration parameter "supabase.service_role_key"` (Supabase internal, not our code)
- All previous fixes (R7-R11) holding

---

## BUG R12-1 -- HIGH: Order status transition validation (R11-2) is completely non-functional

**Root Cause**: Two compounding issues make the R11-2 fix dead code:

### Issue A: Caller never passes `currentStatus`

**File**: `src/components/orders/OrderDetail.tsx` line 118:
```typescript
onValueChange={(v) => updateOrderStatus.mutate({ id: order.id, status: v })}
```
Missing `currentStatus: order.status`. The mutation signature requires `currentStatus` for validation, but it's optional (`currentStatus?: string`), so the guard `if (currentStatus && ...)` silently skips validation.

### Issue B: Transition map is misaligned with real statuses

**File**: `src/hooks/useOrders.ts` lines 126-135

The `ALLOWED_TRANSITIONS` map contains:
```
draft → confirmed → in_production → ready → loading → in-transit → delivered → invoiced → paid
```

But real order statuses (from DB and `OrderDetail.tsx` line 11) are:
```
pending, confirmed, in_production, invoiced, partially_paid, paid, closed, cancelled
```

Problems:
- `"pending"` (the actual initial status set by `convert-quote-to-order`) is missing from the map
- `"draft"` doesn't exist in the system
- `"ready"`, `"loading"`, `"in-transit"`, `"delivered"` don't exist in the UI dropdown
- `"partially_paid"`, `"closed"` are missing from the map
- `sendToQuickBooks` (line 222) directly sets `status: "invoiced"` bypassing validation entirely

**Fix (two changes)**:

1. Update `ALLOWED_TRANSITIONS` to match real statuses:
```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["invoiced", "cancelled"],
  invoiced: ["partially_paid", "paid", "cancelled"],
  partially_paid: ["paid"],
  paid: ["closed"],
  closed: [],
  cancelled: [],
};
```

2. Fix `OrderDetail.tsx` to pass `currentStatus`:
```typescript
onValueChange={(v) => updateOrderStatus.mutate({ 
  id: order.id, 
  status: v, 
  currentStatus: order.status || "pending" 
})}
```

**Severity**: HIGH -- the entire R11-2 workflow integrity fix is non-functional.

---

## BUG R12-2 -- MEDIUM: `sendToQuickBooks` bypasses status transition validation

**File**: `src/hooks/useOrders.ts` line 217-223

After creating a QB invoice, the code directly updates the order status to `"invoiced"`:
```typescript
await supabase.from("orders").update({
  quickbooks_invoice_id: docNumber,
  status: "invoiced",
}).eq("id", orderId);
```

This bypasses `updateOrderStatus.mutate()` and its transition validation. If an order is in `"pending"` status, `sendToQuickBooks` will jump it straight to `"invoiced"`, skipping confirmation and production.

**Fix**: Add a pre-check before the QB call:
```typescript
if (order.status !== "in_production" && order.status !== "confirmed") {
  throw new Error(`Cannot invoice: order is "${order.status}", must be "confirmed" or "in_production" first`);
}
```

**Severity**: MEDIUM -- financial workflow integrity. Mitigated by the existing UI guards (button disabled when items are empty).

---

## BUG R12-3 -- LOW: `OrderDetail` status dropdown shows all statuses regardless of current state

**File**: `src/components/orders/OrderDetail.tsx` lines 119-126

The dropdown always renders all 8 statuses:
```typescript
{STATUSES.map((s) => (
  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
))}
```

Users can see and select invalid transitions. Even with validation in place, the UX is confusing -- users should only see valid next statuses.

**Fix**: Filter the dropdown options based on `ALLOWED_TRANSITIONS`:
```typescript
const allowedNext = ALLOWED_TRANSITIONS[order.status || "pending"] || [];
// Show current status + allowed transitions
const visibleStatuses = [order.status || "pending", ...allowedNext].filter(Boolean);
```

**Severity**: LOW -- UX improvement that reinforces the workflow integrity fix.

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R12-1 | HIGH | Orders | Status transition validation is dead code (no currentStatus + wrong map) | New |
| R12-2 | MEDIUM | Orders/QB | sendToQuickBooks bypasses transition validation | New |
| R12-3 | LOW | Orders UX | Status dropdown shows all statuses, not just valid transitions | New |

---

## Implementation Plan

### Step 1: Fix R12-1 -- Correct the transition map and wire up currentStatus

**File: `src/hooks/useOrders.ts`**
- Replace `ALLOWED_TRANSITIONS` with the corrected map matching real statuses (`pending`, `confirmed`, `in_production`, `invoiced`, `partially_paid`, `paid`, `closed`, `cancelled`)
- Make `currentStatus` required (not optional) -- or fetch current status from DB if not provided

**File: `src/components/orders/OrderDetail.tsx`**
- Pass `currentStatus: order.status || "pending"` to `updateOrderStatus.mutate()`

### Step 2: Fix R12-2 -- Guard sendToQuickBooks against premature invoicing

**File: `src/hooks/useOrders.ts`**
- Add status pre-check before QB invocation: order must be `confirmed` or `in_production`

### Step 3: Fix R12-3 -- Filter dropdown to valid transitions

**File: `src/components/orders/OrderDetail.tsx`**  
- Import `ALLOWED_TRANSITIONS` (export it from `useOrders.ts`)
- Filter `STATUSES` in the dropdown to show only current + valid next statuses

### Do NOT touch:
- `convert-quote-to-order/index.ts` (correctly sets `"pending"` initial status)
- `autopilot-engine/index.ts` (risk policies working correctly)
- Customer delete paths (R7 fix holding)
- Any R7-R11 fixes

---

## Updated Technical Debt Score: 1.5/10

| Category | Score | Delta from R11 |
|----------|-------|----------------|
| Multi-tenant isolation | 9/10 | unchanged |
| Workflow integrity | 4/10 | -4 (transition validation dead code) |
| Data integrity | 8/10 | unchanged |
| Concurrency safety | 8/10 | unchanged |
| API contract accuracy | 8/10 | unchanged |
| Code quality | 7/10 | -1 (map/UI mismatch) |

