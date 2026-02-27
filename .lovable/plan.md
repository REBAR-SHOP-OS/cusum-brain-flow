

## Fix: Stripe payments must use "STRIPE" payment method in QuickBooks

The screenshot shows QuickBooks' Receive Payment screen with "STRIPE" selected as the payment method. Currently, the `stripe-qb-webhook` edge function hardcodes `PaymentMethodRef: { name: "Credit Card" }` when creating payments in QuickBooks, which is incorrect.

### Changes

**`supabase/functions/stripe-qb-webhook/index.ts`** (line 157)

Change the payment method from "Credit Card" to "STRIPE" so Stripe payments are recorded with the correct payment method in QuickBooks, matching the user's QB configuration:

```typescript
// Before
PaymentMethodRef: { name: "Credit Card" },

// After
PaymentMethodRef: { name: "STRIPE" },
```

This ensures that when a Stripe webhook fires and creates a Payment in QuickBooks, it will select "STRIPE" from the payment method list — exactly as shown in the screenshot.

### Technical Note

The `PaymentMethodRef: { name: "STRIPE" }` approach works because QuickBooks matches payment methods by name. The user has already created a "STRIPE" payment method in their QuickBooks account (visible in the dropdown). If the name doesn't match an existing method, QuickBooks auto-creates one.

