

# Fix: Accept Quote 404 on Published Site

## Root Cause (Confirmed via Browser)
The published site at `erp.rebar.shop` is serving a stale JS bundle (`index-CKhfu_69.js`) that does NOT include the `/accept-quote/:quoteId` route. The console error confirms: `404 Error: User attempted to access non-existent route: /accept-quote/test-id`.

The route exists in the codebase (`src/App.tsx` line 264) and works in preview, but the published frontend was never updated after this route was added.

## Fix

### Step 1: Update the Published Frontend (Required — User Action)
You must click the **"Update"** button in the Publish dialog (top-right of the editor). This rebuilds and deploys the frontend bundle with all current routes including `/accept-quote/:quoteId`.

No code changes are needed — the route, component, edge functions, and config are all correct. The only issue is the published build is outdated.

### Step 2: Re-test
After clicking Update, open the acceptance link from your customer's email again. It should load the quote acceptance page instead of showing 404.

## Already Fixed in Previous Rounds (No Further Changes Needed)
- `quote-public-view` in `config.toml` — `verify_jwt = false`
- `send-quote-email` schema — accepts empty `customer_email` for `accept_and_convert`
- `APP_URL` set to `https://cusum-brain-flow.lovable.app`

## No Code Changes Required
This is purely a deployment issue. Click **Update** in the Publish dialog to resolve it.

