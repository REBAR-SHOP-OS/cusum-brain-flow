

## Stripe Payment History — Pull Real Charges from Stripe API

### Problem
The Stripe tile currently shows **$0.00 / 0 payments** because it only reads from the `stripe_payment_links` table, which stores payment *links* created from the app — not actual completed payments. There is no mechanism to fetch real Stripe charges or payment intents.

### Plan

#### 1. Edge function: Add `list-charges` action (`supabase/functions/stripe-payment/index.ts`)

Add a new action that fetches real payment history from Stripe's API:

```typescript
case "list-charges": {
  const limit = params.limit || 100;
  const charges = await stripeRequest(
    `/charges?limit=${limit}&status=succeeded`, "GET"
  );
  return json({ charges: charges.data });
}
```

This returns actual completed Stripe charges with customer name, amount, date, receipt URL, etc.

#### 2. Hook: Fetch Stripe charges in `usePaymentSources.ts`

- Add a new `useQuery` for `stripe_charges` that invokes the edge function with `action: "list-charges"`.
- Map each Stripe charge into a `UnifiedPayment` with:
  - `id`: `stripe-ch-{charge.id}`
  - `date`: from `charge.created` (Unix timestamp → ISO date)
  - `customerName`: from `charge.billing_details.name` or `charge.customer` or "Stripe Customer"
  - `amount`: `charge.amount / 100` (cents → dollars)
  - `source`: `"stripe"`
  - `sourceRef`: `charge.receipt_url`
- Merge these into the unified payments list alongside QuickBooks payments.
- Update the Stripe `SourceSummary` totals to reflect real charge amounts + counts.

#### 3. No DB migration needed
All data comes directly from the Stripe API. No new tables required.

### Files to modify
- **`supabase/functions/stripe-payment/index.ts`** — add `list-charges` action
- **`src/hooks/usePaymentSources.ts`** — fetch charges, merge into unified list, update Stripe summary totals

### Technical details

**Edge function — new action (before the `Unknown action` fallback):**
```typescript
if (action === "list-charges") {
  const limit = Math.min(Number(params.limit) || 100, 100);
  const charges = await stripeRequest(`/charges?limit=${limit}`, "GET");
  const succeeded = (charges.data || []).filter(c => c.status === "succeeded");
  return json({ charges: succeeded });
}
```

**Hook — new query + unified merge:**
```typescript
const { data: stripeCharges } = useQuery({
  queryKey: ["stripe_charges"],
  queryFn: async () => {
    const { data } = await supabase.functions.invoke("stripe-payment", {
      body: { action: "list-charges", limit: 100 },
    });
    return data?.charges ?? [];
  },
  staleTime: 1000 * 60 * 5,
  retry: 1,
});

// In unifiedPayments memo — add charge-based payments:
const stripeChg: UnifiedPayment[] = (stripeCharges ?? []).map((c: any) => ({
  id: `stripe-ch-${c.id}`,
  date: new Date(c.created * 1000).toISOString().slice(0, 10),
  customerName: c.billing_details?.name || c.metadata?.customer_name || "Stripe Customer",
  amount: (c.amount || 0) / 100,
  source: "stripe" as const,
  sourceRef: c.receipt_url,
  raw: c,
}));

// Merge: [...qb, ...stripe (links), ...stripeChg]

// Update Stripe summary to use charge totals:
const stripeChargeTotal = (stripeCharges ?? []).reduce(
  (s, c) => s + ((c.amount || 0) / 100), 0
);
```

