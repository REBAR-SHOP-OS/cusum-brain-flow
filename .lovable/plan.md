

## Fix: RingCentral Embeddable Widget "Redirect URIs do not match" (OAU-109)

### Problem
The RingCentral Embeddable widget loads with your app's `clientId` but doesn't specify a `redirectUri`. When you click "Sign In", RingCentral's OAuth uses a default redirect URI that doesn't match what's registered in your RingCentral app configuration.

### Root Cause
In `src/hooks/useRingCentralWidget.ts` (line 126-129), the widget is configured with `clientId` and `appServer` but missing the `redirectUri` parameter.

### Solution
Add the correct `redirectUri` to the Embeddable widget parameters. The RingCentral Embeddable widget requires a redirect URI that points to its own built-in OAuth redirect handler.

### Changes

**File: `src/hooks/useRingCentralWidget.ts`**
- Add `redirectUri` parameter when loading the widget script with a custom `clientId`
- The redirect URI must match exactly what is registered in the RingCentral Developer Console for your app
- The standard Embeddable redirect URI format is: `https://{your-domain}/integrations/callback` or the Embeddable's own handler at the widget origin

Two options to resolve:

**Option A (Recommended)**: Add the Embeddable widget's own redirect URI to your RingCentral app in the Developer Console. The Embeddable widget's default redirect URI is `https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html`. Add this URL to your RingCentral app's "OAuth Redirect URI" list.

**Option B**: Set `redirectUri` in the widget params to match one already registered in your RingCentral app (e.g., `https://erp.rebar.shop/integrations/callback`). However, this only works if that page handles the Embeddable's OAuth flow correctly.

### Implementation

1. **In `useRingCentralWidget.ts`** — Add the redirect URI parameter:
```typescript
if (clientId) {
  params.set("clientId", clientId);
  params.set("appServer", "https://platform.ringcentral.com");
  params.set("redirectUri", "https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html");
}
```

2. **In RingCentral Developer Console** — Add `https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html` to the OAuth Redirect URI list for your app.

### Technical Details
- The Embeddable widget handles OAuth internally when given its own redirect handler URL
- This redirect page is hosted by RingCentral and simply passes the auth code back to the widget iframe
- No changes needed to edge functions or other files

