

## Stripe Connection Stability Fix

### Problem
The Stripe tile shows "Disconnected" intermittently because:
1. The edge function has no **key validation** — a misconfigured key (e.g. `pk_` instead of `sk_`) silently fails and returns `status: "error"`, which the UI treats as "disconnected."
2. The `stripeRequest` helper has **no timeout** — if Stripe is slow, the edge function hangs until Deno kills it, returning a generic error.
3. The `check-status` action catches all errors into a single `status: "error"` bucket with no retry or diagnostic detail.
4. The `StripeCard` and `PaymentSourceStrip` both make separate calls to check Stripe status on every mount, with no caching or retry on transient failures.

### Plan

#### 1. Edge function: Add key validation + timeout + retry (stripe-payment/index.ts)

- **Key validation** at the top of `stripeRequest`: reject `pk_*` and `rk_*` keys with clear error messages.
- **Timeout**: Add `AbortSignal.timeout(15000)` (15s) to every Stripe API fetch call.
- **Retry on 5xx**: If Stripe returns a server error, retry once with 2s backoff before failing.
- **Structured error responses** from `check-status`: return `{ status: "error", errorType: "invalid_key" | "timeout" | "api_error", error: "..." }` so the UI can display actionable messages.

#### 2. StripeCard: Add retry + better error display

- On mount, if `check-status` returns `status: "error"`, retry once after 3 seconds before showing the error state.
- Show the specific error type: "Invalid API key" vs "Connection timeout" vs generic error, so the user knows what to fix.

#### 3. PaymentSourceStrip: Treat "error" differently from "disconnected"

- Currently `usePaymentSources` marks Stripe as "disconnected" when there are 0 links in the DB. This is a data-based check and is correct.
- The `StripeCard` on the Integrations page is the one doing the live API check. No change needed in `PaymentSourceStrip`.

### Files to modify
- **`supabase/functions/stripe-payment/index.ts`** — key validation, timeout, retry in `stripeRequest`, structured error in `check-status`.
- **`src/components/accounting/StripeCard.tsx`** — retry logic on mount, actionable error messages.

### Technical details

**stripeRequest changes:**
```typescript
async function stripeRequest(path, method, body?) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  if (key.startsWith("pk_")) throw new Error("INVALID_KEY: Using publishable key instead of secret key");
  if (key.startsWith("rk_")) throw new Error("INVALID_KEY: Restricted keys not supported");

  // fetch with 15s timeout
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });

  // retry once on 5xx
  if (res.status >= 500) {
    await new Promise(r => setTimeout(r, 2000));
    const retry = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    // ...
  }
}
```

**StripeCard retry:**
```typescript
// If first check-status fails, wait 3s and try once more
if (data?.status !== "connected") {
  await new Promise(r => setTimeout(r, 3000));
  const { data: retry } = await supabase.functions.invoke("stripe-payment", { body: { action: "check-status" } });
  if (retry?.status === "connected") { /* use retry */ }
}
```

