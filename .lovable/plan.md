

# Add Transaction Filter and Payment Method to Receive Payment Dialog

## Overview

Two enhancements to the **CreateTransactionDialog** when creating a Payment, bringing it closer to QuickBooks' "Receive Payment" screen:

1. **Outstanding Items List with Type Filter** -- Show the customer's open invoices and credit memos as selectable rows, with a dropdown to filter by type
2. **Payment Method Selector** -- Add a dropdown for payment method (Check, Cash, Credit Card, etc.) that sends the selection to QuickBooks

---

## What Already Exists

- `CreateTransactionDialog` already handles Payment type with a simple "Payment Amount" input and memo
- The backend (`handleCreatePayment` in `quickbooks-oauth`) already accepts `invoiceId`, `paymentMethod`, and builds `Line` with `LinkedTxn` -- but the frontend never sends these fields
- Customer transactions are already fetched and available via `qb_customer_transactions` query in `CustomerDetail.tsx`
- The dialog currently does NOT show outstanding items or let you pick a payment method

---

## Changes

### File: `src/components/customers/CreateTransactionDialog.tsx`

**1. Fetch outstanding items when type is "Payment"**

Add a query that fetches the customer's open invoices and credit memos from `accounting_mirror` (filtering by `customer_id` and `balance > 0`). This gives us the list of items the payment can be applied to.

**2. Add a type filter dropdown**

Above the outstanding items list, add a Select dropdown with options:
- All Outstanding
- Invoices
- Credit Memos

This filters the displayed list by `entity_type`.

**3. Render outstanding items as selectable rows**

Display a table/list showing each outstanding item with:
- Checkbox to select/deselect
- Date, Type, Doc Number, Original Amount, Open Balance
- When checked, an "Applied Amount" input pre-filled with the open balance (editable)

The total payment amount auto-calculates from the sum of applied amounts (replacing the manual-only input, which stays as an override/display).

**4. Add Payment Method dropdown**

Add a Select above or beside the payment amount with standard QuickBooks payment methods:
- Check
- Cash
- Credit Card
- E-Transfer
- Direct Deposit
- Other

**5. Update submit handler**

When submitting, pass to the backend:
- `paymentMethod`: the selected method value
- `invoiceLines`: array of `{ invoiceId, amount }` for each checked outstanding item (instead of single `invoiceId`)
- Keep backward compatibility: if no items selected, just send `totalAmount` as before

### File: `supabase/functions/quickbooks-oauth/index.ts`

**6. Enhance `handleCreatePayment` to support multiple linked invoices**

Currently it only handles a single `invoiceId`. Update to accept an `invoiceLines` array:
```typescript
// New: support multiple linked transactions
if (invoiceLines && invoiceLines.length > 0) {
  payload.Line = invoiceLines.map(line => ({
    Amount: line.amount,
    LinkedTxn: [{ TxnId: line.invoiceId, TxnType: "Invoice" }],
  }));
}
```
Fall back to the existing single `invoiceId` logic for backward compatibility.

---

## Technical Details

### Outstanding Items Query
```typescript
// Fetch open invoices + credit memos for this customer
const { data: outstandingItems } = useQuery({
  queryKey: ["outstanding-items", customerQbId, companyId],
  enabled: type === "Payment" && !!companyId && !!customerQbId && open,
  queryFn: async () => {
    const { data } = await supabase
      .from("accounting_mirror")
      .select("quickbooks_id, entity_type, balance, data")
      .eq("company_id", companyId)
      .eq("customer_qb_id", customerQbId)
      .in("entity_type", ["Invoice", "CreditMemo"])
      .gt("balance", 0);
    return data || [];
  },
});
```

If `customer_qb_id` is not directly on `accounting_mirror`, we will filter by matching the `CustomerRef.value` inside the JSON `data` field, or join through the `customers` table. The exact approach depends on the schema -- we will verify during implementation.

### New State Variables
```typescript
const [paymentMethodValue, setPaymentMethodValue] = useState("");
const [outstandingFilter, setOutstandingFilter] = useState<"all" | "Invoice" | "CreditMemo">("all");
const [selectedItems, setSelectedItems] = useState<Record<string, number>>({}); // qbId -> applied amount
```

### Auto-Calculate Total
```typescript
const appliedTotal = Object.values(selectedItems).reduce((s, v) => s + v, 0);
// paymentAmount syncs with appliedTotal when items are toggled
```

### Payment Methods Constant
```typescript
const PAYMENT_METHODS = [
  { value: "1", label: "Cash" },
  { value: "2", label: "Check" },
  { value: "3", label: "Credit Card" },
  { value: "4", label: "E-Transfer" },
  { value: "5", label: "Direct Deposit" },
  { value: "other", label: "Other" },
];
```

---

## What Does NOT Change

- No database schema changes required
- No changes to CustomerDetail.tsx or any other component
- Invoice, Estimate, SalesReceipt, and CreditMemo flows in the dialog remain untouched
- The existing backend single-invoice path stays as fallback
- No changes to routing, permissions, or other pages

