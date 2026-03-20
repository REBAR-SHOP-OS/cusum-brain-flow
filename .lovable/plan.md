

## Fix: RingCentral "Access denied" Error

The code is correct. This is a RingCentral Developer Console configuration issue. There are two possible fixes depending on whether your new app is in Sandbox or Production.

### Option A — If the app is still in Sandbox (most likely)

Change `appServer` from the production URL to the sandbox URL:

**File:** `src/hooks/useRingCentralWidget.ts` (line 102)

```
// Change FROM:
appServer: "https://platform.ringcentral.com",

// Change TO:
appServer: "https://platform.devtest.ringcentral.com",
```

This lets the widget authenticate against the sandbox environment where new apps are created by default.

### Option B — If you want Production access

No code change needed, but in the **RingCentral Developer Console** you must:
1. Go to your app settings
2. Ensure the app type is **"Browser-based"** (not Server/Web)
3. Click **"Graduate"** to move the app from Sandbox to Production
4. Wait for RingCentral approval (can take minutes to hours)

### Recommendation

Start with **Option A** (sandbox) to verify the widget works, then graduate to production later.

