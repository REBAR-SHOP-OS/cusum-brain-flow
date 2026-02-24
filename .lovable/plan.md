

## Fix: Prevent Duplicate QuickBooks Invoices

### Root Cause

There are two layers where duplicate prevention is missing:

1. **Client-side (`useOrders.ts` -- `sendToQuickBooks`)**: The function does not check if `order.quickbooks_invoice_id` already exists before calling the edge function. Clicking "Send to QuickBooks" multiple times (or on an already-invoiced order) creates a new invoice each time.

2. **Server-side (`quickbooks-oauth/index.ts` -- `handleCreateInvoice`)**: The edge function blindly POSTs to the QuickBooks Invoice API without checking if an invoice for that order/memo already exists. There is no idempotency guard.

### Fix (2 files)

#### 1. Client-side guard -- `src/hooks/useOrders.ts`

Add an early check in `sendToQuickBooks`: if the order already has a `quickbooks_invoice_id`, throw an error instead of creating a duplicate.

```typescript
// Before fetching items:
if (order.quickbooks_invoice_id) {
  throw new Error(`Order already invoiced (Invoice #${order.quickbooks_invoice_id})`);
}
```

#### 2. Server-side idempotency -- `supabase/functions/quickbooks-oauth/index.ts`

Add an optional `orderId` parameter to `handleCreateInvoice`. When provided:
- Query the `orders` table for that order's `quickbooks_invoice_id`
- If one already exists, return the existing invoice info instead of creating a new one
- If not, proceed with creation as normal

```text
handleCreateInvoice receives body.orderId (optional)
  |
  +-- orderId provided?
       |
       Yes --> Query orders table for quickbooks_invoice_id
       |       |
       |       +-- Already has QB ID? --> Return existing (skip creation)
       |       +-- No QB ID? --> Create invoice, update orders row
       |
       No --> Create invoice as before (backwards compatible)
```

#### 3. Pass `orderId` from client -- `src/hooks/useOrders.ts`

Update the `sendToQuickBooks` call to include `orderId` in the request body so the edge function can perform the server-side check.

### Summary of Changes

| File | Change |
|---|---|
| `src/hooks/useOrders.ts` | Add client-side guard checking `quickbooks_invoice_id` before calling edge function; pass `orderId` in request body |
| `supabase/functions/quickbooks-oauth/index.ts` | Add idempotency check in `handleCreateInvoice` -- query `orders` table for existing QB invoice ID before creating |

### Why Both Layers?

- **Client guard** provides instant feedback (no network round-trip) and prevents accidental re-clicks
- **Server guard** prevents race conditions where two concurrent requests could both pass the client check before either writes back the invoice ID

