

## Fixes for Invoice Preview

Two bugs visible in the screenshot:

### 1. Billing Address shows "false false false"

**File: `src/components/accounting/InvoiceEditor.tsx`**

The `formatAddr` function uses `.filter(Boolean)` but QuickBooks returns the string `"false"` for empty address fields. Fix: add a filter that also excludes the literal string `"false"`.

Change line 47 from:
```
.filter(Boolean)
```
to:
```
.filter(v => v && v !== false && String(v) !== "false")
```

### 2. Payment Links section — clarify the issue

The Payment Links section IS visible in your screenshot with both "Pay via QuickBooks" and "Pay via Stripe" buttons. Could you clarify what's not working?

- Is the Stripe link not generating when clicked?
- Should the payment links be hidden in this view?
- Or is the section styling/visibility the problem?

### 3. "Product is not there" — clarify

The line items table shows "Rebar Fabrication & Supply Only" (qty 2.53) and "Shipping" (qty 1.00) which appear to be parsed from QuickBooks. Are these the wrong items, or are you referring to something else missing?

