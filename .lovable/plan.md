

# Fix: Accept Quote Link Points to Non-Working Domain

## Problem
The screenshot shows `www.erp.rebar.shop` returning `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. This domain does not have SSL configured, so any customer clicking the "Accept Quote" link in their email gets a broken page.

## Root Cause
The `APP_URL` in `send-quote-email` was changed from `crm.rebar.shop` to `erp.rebar.shop`, but `erp.rebar.shop` is not set up as a custom domain with SSL on this project. The published URL is `cusum-brain-flow.lovable.app`.

## Two Options

### Option A: Fix the domain setup (recommended long-term)
Connect `erp.rebar.shop` as a custom domain in Project Settings > Domains. This requires:
- Adding A records for `@` and `www` pointing to `185.158.133.1`
- Adding the TXT verification record
- Waiting for SSL provisioning

Until this is done, no customer-facing links to `erp.rebar.shop` will work.

### Option B: Revert APP_URL to working domain (immediate fix)
Change `APP_URL` back to whichever domain actually works. Options:
- `https://cusum-brain-flow.lovable.app` (the published Lovable URL — always works)
- `https://www.crm.rebar.shop` (if this domain was previously working with SSL)

## Recommended Plan
1. **Immediate**: Change `APP_URL` in `send-quote-email` to `https://cusum-brain-flow.lovable.app` so accept-quote links work now
2. **Also update**: `AcceptQuote.tsx` terms links and `ai-generate-quotation` terms URL to use the same working domain
3. **Later**: Once `erp.rebar.shop` is properly configured with SSL, update all URLs back

## Alternative
If `crm.rebar.shop` still has valid DNS/SSL, revert to that instead. Do you want me to check which domain is currently working, or should I use the Lovable published URL as the immediate fix?

## Files to Change
- `supabase/functions/send-quote-email/index.ts` — APP_URL
- `supabase/functions/ai-generate-quotation/index.ts` — terms URL
- `src/pages/AcceptQuote.tsx` — terms links

