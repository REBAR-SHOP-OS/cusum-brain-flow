

# Fix QuickBooks Live Report "Permission Denied" — Proper Detection and Guided Reconnect

## Root Cause Analysis

The 5020 "Permission Denied" error means the QuickBooks user who authorized the OAuth flow does not have report-level access in their QuickBooks company settings, OR the Intuit consent screen permissions were not fully granted.

**Critical bug found**: The `withReportFallback` wrapper returns HTTP 200 with `{ fallback: true, error: "PERMISSION_DENIED" }`. But in `admin-chat`, the code checks `reportRes.ok` (which is true for 200), then wraps the response as `{ success: true, data: { error: "PERMISSION_DENIED" } }`. Vizzy sees `success: true` but gets garbage data, causing the confusing "connection is live but reports don't work" behavior.

## Changes

### 1. Fix admin-chat report handler to detect fallback responses
**File: `supabase/functions/admin-chat/index.ts`**, lines ~2435-2437

After parsing the JSON response, check for `fallback: true` before returning success. If present, return a structured error with reconnect guidance instead of `success: true`.

```typescript
if (reportRes.ok) {
  const reportData = await reportRes.json();
  // Detect fallback signal from withReportFallback
  if (reportData.fallback === true) {
    return JSON.stringify({
      success: false,
      error_type: reportData.error === "PERMISSION_DENIED" ? "permission_denied" : "service_unavailable",
      user_message: reportData.error === "PERMISSION_DENIED"
        ? "QuickBooks reports are blocked — the authorizing user needs Admin access in QuickBooks. Go to Integrations → disconnect QuickBooks → reconnect, and ensure 'Accounting' permissions are fully granted on the Intuit screen."
        : "QuickBooks report temporarily unavailable. Use local snapshot data instead.",
      retryable: reportData.error !== "PERMISSION_DENIED",
      needs_reconnect: reportData.error === "PERMISSION_DENIED",
      use_snapshot: true,
    });
  }
  return JSON.stringify({ success: true, report_type: args.report_type, data: reportData });
}
```

### 2. Same fix in agentToolExecutor.ts
**File: `supabase/functions/_shared/agentToolExecutor.ts`**, lines ~726-728

Apply the same fallback detection pattern so MCP-routed report calls also handle permission errors correctly.

### 3. Add report-access probe to check-status
**File: `supabase/functions/quickbooks-oauth/index.ts`**, in `handleCheckStatus`

After confirming the token is valid (line ~957), add a lightweight report probe:
```typescript
// Quick report access test
let reportAccess = "unknown";
try {
  await qbFetch(config, `reports/ProfitAndLoss?start_date=2026-01-01&end_date=2026-01-02`);
  reportAccess = "granted";
} catch (err) {
  if (String(err).includes("5020") || String(err).includes("Permission Denied")) {
    reportAccess = "denied";
  }
}
return jsonRes({ status: "connected", realmId: config.realm_id, reportAccess });
```

This lets the Integrations page show whether report access is working after reconnect.

### 4. Surface report access status in Integrations UI
**File: `src/hooks/useIntegrations.ts`**, QuickBooks check-status handler (~line 214-236)

When `statusData.reportAccess === "denied"`, show a warning toast:
```
"QuickBooks connected, but report access is denied. 
The authorizing user needs Admin-level access in QuickBooks."
```

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/admin-chat/index.ts` | Detect `fallback: true` in QB report response, return proper error |
| `supabase/functions/_shared/agentToolExecutor.ts` | Same fallback detection for MCP path |
| `supabase/functions/quickbooks-oauth/index.ts` | Add report-access probe in check-status |
| `src/hooks/useIntegrations.ts` | Surface report access warning in UI |

## Result
- Vizzy no longer says "connection is live" when reports are actually blocked
- Vizzy gives clear guidance: "Disconnect → Reconnect with Admin user"
- Check-status actively tests report access after each reconnect
- User sees toast warning if reports are still blocked after reconnecting

