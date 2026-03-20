

## Fix: RingCentral Widget DNS Failure

The screenshot shows `platform.devtest.ringcentral.com` returning `DNS_PROBE_FINISHED_NXDOMAIN` — the sandbox domain is no longer available. RingCentral has deprecated the separate sandbox domain. Your new app should use the production platform URL.

### Change

**File:** `src/hooks/useRingCentralWidget.ts`

Change `appServer` back to production:
```
appServer: "https://platform.ringcentral.com",
```

This single line change fixes the DNS failure. If the app still shows "Access denied" after this, the app needs to be graduated to Production in the RingCentral Developer Console.

