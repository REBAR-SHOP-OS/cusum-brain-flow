

## Make QuickBooks a Company-Wide Connection

### Problem
QuickBooks only allows one admin per connected app. Currently, the system stores a separate QB connection per user (`user_id` in `integration_connections`). When Sattar connects, QuickBooks revokes Vicky's token, breaking her access.

### Solution
Change the QuickBooks integration to use a single **company-level** connection. One admin connects once, and all users in the same company share that token for API calls.

### Technical Details

**1. Edge Function: `quickbooks-oauth/index.ts`**

- **`getQBConfig()`**: Instead of looking up by `user_id`, first get the user's `company_id` from `profiles`, then find ANY connected QB row for that company. This means all users in the same company share the same QB token.
- **`handleCallback()`**: On OAuth success, look up the user's `company_id` and store the connection with a `company_id` field in the config. Also delete any other QB connections for the same company (cleanup duplicates).
- **`handleCheckStatus()`**: Look up by company instead of just user. If a company-mate already connected, return "connected" for everyone.
- **`handleDisconnect()`**: Disconnect the company-wide token (only admins should do this).
- **Token refresh**: Works the same, just queries by company instead of individual user.
- **All data endpoints** (sync-customers, list-invoices, etc.): Already call `getQBConfig()` so they'll automatically use the shared token once that function is updated.

**2. Frontend: `useQuickBooksData.ts` / `useIntegrations.ts`**
- No changes needed — the frontend already calls the edge function with the user's auth token, and the edge function will resolve the company connection server-side.

**3. Data Migration**
- Clean up the duplicate: delete Vicky's stale QB connection row (her token is already revoked by Intuit) and keep only Sattar's active one.
- Add `company_id` to the existing connection config so future lookups work by company.

### What Changes for Users
- Only one person per company needs to connect QuickBooks
- Everyone in the company automatically gets access to QB data
- No more "kicking out" the other admin when someone reconnects
