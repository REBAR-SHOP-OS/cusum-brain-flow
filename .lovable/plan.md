
# Fix: RingCentral "Session Expired" Error

## Problem
When you click Connect on RingCentral, the OAuth flow opens a popup that redirects to `https://erp.rebar.shop/integrations/callback`. This callback page tries to find your login session in the browser -- but because the popup is on a different domain than where you're logged in, it can't find the session and shows "Session expired."

## Solution
Change the RingCentral flow to match how QuickBooks works: instead of redirecting back to your app's callback page (which needs a browser session), redirect to the backend function itself. The backend function will exchange the code, save the tokens, and then redirect the popup to the callback page with a simple `?status=success` message.

## Changes

### 1. Update the RingCentral backend function (`supabase/functions/ringcentral-oauth/index.ts`)
- In the `get-auth-url` action: embed the user ID in the OAuth `state` parameter (e.g., `userId|ringcentral`) and set the redirect URI to the edge function URL (`/functions/v1/ringcentral-oauth/callback`)
- Add a new `callback` handler for GET requests: parse the `code` and `state` from the URL, extract the user ID from state, exchange the code for tokens server-side, save them, and issue a 302 redirect to `https://erp.rebar.shop/integrations/callback?status=success&integration=ringcentral`
- On error, redirect to `?status=error&message=...`

### 2. Update the client-side OAuth start (`src/hooks/useIntegrations.ts`)
- Remove the `redirectUri` parameter from the RingCentral `get-auth-url` call (the edge function will determine its own redirect URI)

### 3. Update RingCentral Developer Portal
- Change the OAuth Redirect URI from `https://erp.rebar.shop/integrations/callback` to your backend function URL (will be provided after implementation)

## Why This Works
The backend function has service-role access to the database, so it doesn't need a browser session. It already knows the user ID from the state parameter. The callback page just shows a success/error message -- no code exchange needed.
