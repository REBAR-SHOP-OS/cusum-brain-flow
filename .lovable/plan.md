

# Fix RingCentral OAuth Connect Flow

## Problem
When Neel clicks "Connect" on RingCentral in the Integrations page, **nothing useful happens** because:

1. `ringcentral` is missing from the `oauthIntegrations` array, so it opens a manual credential form instead of the OAuth popup.
2. The `startOAuth` function in `useIntegrations.ts` has no handler for `ringcentral`, so even if triggered, it would do nothing.

The backend edge function (`ringcentral-oauth`) already fully supports `get-auth-url` and `exchange-code` actions -- the frontend just never calls them.

## Fix (2 files)

### 1. `src/pages/Integrations.tsx`
- Add `"ringcentral"` to the `oauthIntegrations` array so clicking it opens the Connect dialog instead of the manual setup form.

### 2. `src/hooks/useIntegrations.ts`
- Add a `ringcentral` case in the `startOAuth` function that:
  - Calls the `ringcentral-oauth` edge function with `action: "get-auth-url"` and the redirect URI.
  - Opens the returned auth URL in a popup window.
- Also update the RingCentral status check in `checkIntegrationStatus` and `checkAllStatuses` to use the proper `ringcentral-oauth` edge function with `action: "check-status"` (instead of calling `ringcentral-sync` which is the wrong function for status checking).

### 3. `src/pages/IntegrationCallback.tsx`
- Ensure the `ringcentral` state is already handled in the callback -- it is (line 79), so no change needed there.

## Expected Result
After this fix:
1. Neel clicks RingCentral -> sees Connect dialog
2. Clicks Connect -> popup opens to RingCentral login
3. Logs in with his own RC credentials
4. Popup closes, tokens are saved, RingCentral shows "Connected"
5. Inbox Sync will then pull his calls

