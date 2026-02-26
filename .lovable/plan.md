

## Diagnosis

The error message "This API call cannot be made with a publishable API key. Please use a secret API key" means the `STRIPE_SECRET_KEY` secret currently stored has a **publishable key** value (starts with `pk_`) instead of a **secret key** (starts with `sk_`).

The edge function code and integration wiring are correct. The only fix needed is updating the secret value.

## Plan

1. **Update the `STRIPE_SECRET_KEY` secret** with the correct Stripe secret key (starts with `sk_live_` or `sk_test_`). You can find it at [Stripe Dashboard > API Keys](https://dashboard.stripe.com/account/apikeys).

No code changes are required -- just the secret value needs to be corrected.

