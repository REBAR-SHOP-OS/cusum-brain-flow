

## Plan: Use New RingCentral App Only for Widget (Calls), Keep Old App for Backend

### Problem
Currently the widget fetches its `clientId` from the `ringcentral-recording` edge function, which returns the old app's Client ID. You want the **new app** (`99KxuQlTa6aepPopPBwkd3`) used only for the Embeddable widget (making/receiving calls), while the **old app** continues to handle SIP provisioning, recordings, active calls, etc.

### Changes

**1. Hardcode the new Client ID in the widget hook**

File: `src/hooks/useRingCentralWidget.ts`

Instead of fetching `clientId` from the backend edge function, hardcode the new app's Client ID directly for the widget. Remove the fetch call to `ringcentral-recording?action=client-id`. The widget will always use the new app credentials.

```typescript
// Remove the entire fetch block (lines 95-117)
// Replace with:
const clientId = "99KxuQlTa6aepPopPBwkd3";
```

Also update the `redirectUri` to match the new app's registered redirect:
```
https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html
```

**2. No changes to edge functions**

The backend functions (`ringcentral-sip-provision`, `ringcentral-recording`, `ringcentral-active-calls`) continue using the old `RINGCENTRAL_CLIENT_ID` and `RINGCENTRAL_CLIENT_SECRET` secrets — no changes needed there.

### Summary

| Component | App Used |
|-----------|----------|
| Embeddable Widget (calls) | New app (`99Kxu...`) |
| SIP Provision | Old app (from secrets) |
| Recordings | Old app (from secrets) |
| Active Calls | Old app (from secrets) |

