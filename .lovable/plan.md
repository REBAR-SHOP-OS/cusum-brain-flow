

# Fix Duplicate Invoice Creation — Idempotency Guard

## Root Cause

There are two code paths that create QuickBooks invoices:

1. **`useOrders.sendToQuickBooks`** — passes `orderId`, server checks for existing `quickbooks_invoice_id` before creating. **Already idempotent.**
2. **`CreateTransactionDialog`** — creates invoices directly from the customer detail page with NO `orderId` and NO dedup key. Every submit creates a new QB invoice. **This is the source of duplicates like #2253, #2253-1, #2253-2.**

## Solution — Two-layer idempotency

### 1. Frontend: Add submission guard with cooldown (`CreateTransactionDialog.tsx`)

- After a successful invoice creation, store a short-lived "last created" fingerprint (customer + amount + timestamp) to prevent identical re-submissions within 60 seconds
- Show a confirmation dialog if the user tries to create an invoice with the same customer and amount within that window: *"You just created Invoice #XXXX for this customer 30s ago. Create another?"*

### 2. Backend: Content-based dedup in `handleCreateInvoice` (`quickbooks-oauth/index.ts`)

When no `orderId` is provided (ad-hoc invoice from CreateTransactionDialog):
- Before creating, query QuickBooks for recent invoices (last 24h) matching the same `CustomerRef` and `TotalAmt`
- If a match is found and it's less than 5 minutes old, return the existing invoice instead of creating a new one
- Add a `dedupKey` parameter option: if the frontend generates a unique key per form session (e.g. `crypto.randomUUID()` on dialog open), the server can use it to track and prevent duplicate submissions

### 3. Frontend: Generate a `dedupKey` per dialog session (`CreateTransactionDialog.tsx`)

- On dialog open, generate `dedupKey = crypto.randomUUID()`
- Pass it in the request body to `quickbooks-oauth`
- Server stores `dedupKey` in a lightweight cache (or checks `audit_log`) before creating

### Files to Change

| File | Change |
|------|--------|
| `src/components/customers/CreateTransactionDialog.tsx` | Generate `dedupKey` on open, pass in body, add recent-creation warning |
| `supabase/functions/quickbooks-oauth/index.ts` | In `handleCreateInvoice`: when no `orderId`, check `audit_log` for matching `dedupKey` in last 5 min; if found, return existing invoice |

### Implementation Detail

**CreateTransactionDialog.tsx:**
```ts
// On dialog open, generate unique session key
const [dedupKey] = useState(() => crypto.randomUUID());

// In submit handler, add to body:
body.dedupKey = dedupKey;
```

**quickbooks-oauth/index.ts — handleCreateInvoice:**
```ts
// After orderId check, add dedupKey check:
if (dedupKey) {
  const { data: existing } = await supabase
    .from("audit_log")
    .select("details")
    .eq("event_type", "qb_invoice_created")
    .eq("details->>dedupKey", dedupKey)
    .maybeSingle();
  if (existing) {
    return jsonRes({
      success: true,
      alreadyExisted: true,
      docNumber: existing.details.docNumber,
      message: "Duplicate prevented — invoice already created for this session",
    });
  }
}

// In audit log call, include dedupKey:
await logAuditEvent(..., { docNumber, customerId, totalAmount, orderId, dedupKey });
```

No database schema changes needed — uses existing `audit_log` table.

