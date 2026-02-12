
## Path A — Money Sprint: Orders Pricing, Quotes, and QuickBooks Handoff

### Current State (verified from DB)

| Entity | Count | Status |
|--------|-------|--------|
| Quotes (from Odoo) | 2,586 | 969 confirmed ("sale"), 1,480 sent, 85 draft, 52 cancelled |
| Orders | 15 | All "pending", all `total_amount = 0.00`, no QB invoice linked |
| QB Invoices (mirror) | 1,835 | Synced from QuickBooks, with balances |
| Customers with QB ID | Many | QuickBooks IDs already mapped |

**Key problems:**
1. Orders have `total_amount = 0` -- no pricing flows from quotes to orders
2. No `order_items` table exists -- orders have no line items at all
3. No `quote_items` table exists -- quote line items live only in Odoo
4. No quote-to-order conversion workflow -- `orders.quote_id` exists but is always NULL
5. No order-to-QuickBooks-invoice pipeline -- `quickbooks_invoice_id` is always NULL

### What This Sprint Delivers

A complete money pipeline: **Quote (Odoo) -> Order (with pricing) -> QuickBooks Invoice** -- all from within the ERP.

---

### Step 1: Create `order_items` table (migration)

New table to hold line-item pricing for orders:

```
order_items
- id (uuid, PK)
- order_id (uuid, FK -> orders)
- description (text)
- quantity (numeric, default 1)
- unit_price (numeric, default 0)
- total_price (numeric, generated or computed)
- bar_size (text, nullable) -- rebar-specific
- length_mm (numeric, nullable)
- shape (text, nullable)
- notes (text, nullable)
- created_at, updated_at
```

Add RLS policies scoped to company_id (via the order's company_id).

### Step 2: Quote-to-Order conversion

**New edge function: `convert-quote-to-order`**

Takes a quote ID, creates an order with:
- `quote_id` linked
- `total_amount` copied from quote
- `customer_id` carried over
- Status set to "pending"

If the quote has line items in its `metadata` (from Odoo sync), those become `order_items`.

**UI: Add "Convert to Order" button** on quotes list (for quotes with status = "sale").

### Step 3: Order pricing UI

**Enhance the orders view** to show:
- Line items with editable quantities and unit prices
- Auto-calculated total that writes back to `orders.total_amount`
- Add/remove line items inline
- Customer name and linked quote number visible

### Step 4: Order-to-QuickBooks Invoice

**New action: "Create QB Invoice" on an order**

Flow:
1. User clicks "Send to QuickBooks" on a priced order
2. System looks up the customer's `quickbooks_id`
3. Calls existing `create-invoice` action on `quickbooks-oauth` with line items from `order_items`
4. Stores returned `DocNumber` in `orders.quickbooks_invoice_id`
5. Order status advances to "invoiced"

**Requires:** Customer must have a `quickbooks_id`. Show a warning if missing, with option to create/link.

### Step 5: Order status lifecycle

Extend order statuses from just "pending" to a proper lifecycle:

```
pending -> confirmed -> in_production -> invoiced -> paid -> closed
                                          |
                                          v (from QB sync)
                                        partially_paid
```

Add a validation trigger similar to existing ones.

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: `order_items` table + RLS + order status trigger |
| `supabase/functions/convert-quote-to-order/index.ts` | New edge function |
| `src/hooks/useOrders.ts` | New hook: CRUD for orders + order_items, QB invoice creation |
| `src/components/orders/OrderDetail.tsx` | New: line items editor, pricing, "Send to QB" button |
| `src/components/orders/OrderList.tsx` | Enhanced: show totals, status badges, filter by status |
| `src/components/orders/ConvertQuoteDialog.tsx` | New: confirmation dialog for quote-to-order |
| Quotes view (existing) | Add "Convert to Order" action button |
| `src/components/ceo/ExceptionsWorkbench.tsx` | Surface orders with $0 total as exceptions |

### What This Does NOT Include (deferred)

- Quote line item sync from Odoo (Odoo API only gives totals, not lines -- would need `sale.order.line` model)
- Automated invoicing (always manual "Send to QB" for now)
- Payment reconciliation (QB sync already handles this)

### Risk: Odoo line items

The Odoo sync currently pulls `amount_total` but not individual line items from `sale.order.line`. The quote-to-order conversion will carry the total but line items will need manual entry unless we add a second Odoo sync for order lines. This can be a fast follow-up.
