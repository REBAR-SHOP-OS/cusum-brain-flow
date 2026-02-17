
# Build Smart Transaction Creation with Pattern Learning

## Overview
Wire up the "New transaction" dropdown in CustomerDetail to actually create Invoices, Estimates (Quotations), Payments, Credit Memos, and Sales Receipts in QuickBooks. Add a pattern-learning system so that when a human creates a transaction for a customer with credit/balance, the system remembers the pattern and auto-suggests (or auto-creates with one click) the same action next time it sees a similar situation.

## What Will Be Built

### 1. New Component: `CreateTransactionDialog.tsx`
A single reusable dialog that handles all transaction types:

- **Invoice**: Line items (description, qty, unit price), due date, memo
- **Estimate / Quotation**: Line items, expiration date, memo
- **Payment**: Amount, optional linked invoice dropdown (from open invoices), payment method, memo
- **Sales Receipt**: Line items, memo
- **Credit Memo**: Line items, memo

Features:
- Dynamic line items (add/remove rows)
- Auto-calculated totals
- Pre-filled customer info from parent context
- Calls the existing `quickbooks-oauth` edge function with the correct action
- Success toast and auto-refresh of transaction data

### 2. Wire Up CustomerDetail Dropdown
Connect each "New transaction" dropdown item to open the dialog with the correct transaction type. Pass `quickbooks_id` and `name` from the customer context.

### 3. Pattern Learning System (Smart Automation)

**New database table: `transaction_patterns`**
Stores patterns from human-created transactions:
- `customer_qb_id` -- which customer
- `trigger_condition` -- JSON describing what triggered it (e.g., `{"has_credit": true, "credit_above": 1000}`)
- `action_type` -- what was done (e.g., `create-invoice`, `create-payment`)
- `action_payload_template` -- template of the transaction data (line items, amounts, etc.)
- `times_used` -- how many times this pattern was applied
- `auto_execute` -- whether to auto-execute or just suggest (defaults to false/suggest)
- `created_by`, `company_id`

**How it works:**
1. When a user creates a transaction through the dialog, the system records the pattern (customer type, balance condition, transaction type, line item structure)
2. Next time a customer with a similar condition is opened, a banner appears: "Previously, you created an Invoice for customers with credit > $X. Create one now?" with a one-click "Apply" button
3. If the user applies it 3+ times, the system upgrades the suggestion to "auto-draft" -- it pre-fills the dialog and just needs a confirm click
4. The system never fully auto-executes financial transactions (respects the "Silent Automation Kill Rule" -- no auto-posting without human validation)

### 4. Smart Suggestion Banner in CustomerDetail
When a customer detail view opens and the customer has credit/balance:
- Query `transaction_patterns` for matching conditions
- Show a compact suggestion card: "Based on past actions: Create Invoice for $X" with "Apply" and "Dismiss" buttons
- Clicking "Apply" opens the CreateTransactionDialog pre-filled with the pattern data

## Files Modified

| File | Change |
|------|--------|
| `src/components/customers/CreateTransactionDialog.tsx` | **New** -- Reusable dialog for all transaction types |
| `src/components/customers/CustomerDetail.tsx` | Wire dropdown items to open dialog; add pattern suggestion banner |
| `src/components/accounting/AccountingCustomers.tsx` | No change needed -- flows through CustomerDetail automatically |

## Database Changes

**New table: `transaction_patterns`**
```
id (uuid, PK)
company_id (uuid, FK -> companies)
customer_qb_id (text, nullable) -- null means "any customer"
trigger_condition (jsonb) -- e.g. {"has_open_balance": true, "balance_gt": 500}
action_type (text) -- create-invoice, create-payment, etc.
action_payload_template (jsonb) -- line items template, terms, etc.
times_used (int, default 0)
auto_suggest (boolean, default true)
created_by (uuid, FK -> auth.users)
created_at, updated_at (timestamptz)
```

RLS: Users in the same company can read/write patterns.

## Technical Details

- The dialog uses `supabase.functions.invoke("quickbooks-oauth", { body: { action, ...payload } })` to call the existing backend handlers
- After successful creation, invalidate `qb_transactions` and `quickbooks-data` queries
- Pattern recording happens client-side after a successful transaction creation -- inserts into `transaction_patterns`
- Pattern matching runs on CustomerDetail mount: checks customer's balance/credit against stored trigger conditions
- Respects the production directive: no auto-posting. The pattern system only pre-fills and suggests -- the human always clicks "Create" to confirm
- The `penny_collection_queue` system continues to work independently for collection actions; this new system covers all transaction types
