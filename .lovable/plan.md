

## Stripe Tile — Wire Live Connection Status

### Problem
The Stripe tile in `PaymentSourceStrip` determines its status purely from the `stripe_payment_links` DB table count. If there are 0 rows, it shows "Disconnected" — even when Stripe credentials are valid and the integration is live. The tile never calls the `stripe-payment` edge function to verify the actual connection.

### Fix
Add a live `check-status` call to the `stripe-payment` edge function inside `usePaymentSources`. Use the result to set the Stripe tile status independently of the payment link count.

### Changes

**`src/hooks/usePaymentSources.ts`**:
- Add a new `useQuery` that calls `supabase.functions.invoke("stripe-payment", { body: { action: "check-status" } })`.
- Use the result to determine Stripe status: `"connected"` if the edge function returns `status: "connected"`, `"error"` if it returns an error type, `"disconnected"` otherwise.
- Also capture the `accountName` from the response to display in the tile.
- Update the Stripe `SourceSummary` to use this live status instead of the link-count heuristic.

**`src/components/accounting/PaymentSourceStrip.tsx`**:
- Add `"error"` to `STATUS_LABEL` map so it renders properly.
- No other changes needed — the component already reads from `SourceSummary`.

**`src/hooks/usePaymentSources.ts` — SourceSummary type**:
- Add `"error"` to the status union type.

### Technical Detail
```typescript
// New query in usePaymentSources
const { data: stripeStatus } = useQuery({
  queryKey: ["stripe_live_status"],
  queryFn: async () => {
    const { data } = await supabase.functions.invoke("stripe-payment", {
      body: { action: "check-status" },
    });
    return data;
  },
  staleTime: 1000 * 60 * 5,
  retry: 1,
});

// In sourceSummaries memo, replace the stripe status line:
status: stripeStatus?.status === "connected"
  ? "connected"
  : stripeStatus?.errorType
    ? "error"
    : "disconnected",
```

