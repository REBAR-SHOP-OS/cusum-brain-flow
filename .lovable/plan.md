

## Diagnosis: "Login failed due to internal errors"

The previous OAU-109 (redirect URI mismatch) error is resolved — the widget now shows a different error. "Login failed due to internal errors" from the RingCentral Embeddable widget typically indicates one of these issues:

1. **The RingCentral app in the Developer Console is still in "Sandbox" mode** — it must be set to Production to use `platform.ringcentral.com`
2. **The `redirectUri` doesn't match what's registered** — the GitHub-hosted redirect page (`https://ringcentral.github.io/ringcentral-embeddable/redirect.html`) must be in the app's OAuth Redirect URI list
3. **App Server mismatch** — Sandbox apps must use `https://platform.devtest.ringcentral.com`, not `https://platform.ringcentral.com`

### Required Action (no code change needed)

The code is correct. This is a **RingCentral Developer Console configuration issue**. You need to verify:

1. **App environment**: If your RingCentral app is a **Sandbox** app, change `appServer` to `https://platform.devtest.ringcentral.com`. If it's a **Production** app, the current `platform.ringcentral.com` is correct.

2. **Redirect URI registered**: Ensure `https://ringcentral.github.io/ringcentral-embeddable/redirect.html` is added to the OAuth Redirect URI list in your RingCentral app settings.

3. **App status**: The app must be graduated to Production if using the production server.

### Code Change (only if Sandbox)

If your RingCentral app is in Sandbox mode, we need to switch `appServer`:

**File: `src/hooks/useRingCentralWidget.ts` line 128**
```typescript
// Change from:
params.set("appServer", "https://platform.ringcentral.com");
// To:
params.set("appServer", "https://platform.devtest.ringcentral.com");
```

### Recommendation

Check your RingCentral Developer Console to confirm whether the app is Sandbox or Production, then I'll update the code accordingly.

