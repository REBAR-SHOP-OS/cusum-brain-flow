

# Fix Odoo Sync "undefined" Toast Message

## Problem

When clicking "Odoo Sync" in the Pipeline menu, the toast shows:
> **Odoo Sync Complete**  
> undefined created, undefined updated, 0 reconciled, undefined errors (undefined total, undefined mode)

This happens because the edge function returns a response **without** the expected fields in certain cases, but the client always assumes success and tries to read `data.created`, `data.updated`, etc.

## Root Cause

Two scenarios cause this:

1. **ODOO_ENABLED is not "true"**: The function returns `{ error: "Odoo integration is disabled", disabled: true }` with status 200. Since it's not an HTTP error, `supabase.functions.invoke` doesn't throw — the client proceeds to the toast and reads `.created` (undefined), `.updated` (undefined), etc.

2. **Auth failure returning 401**: Returns `{ error: "Unauthorized" }` — similar issue if the SDK doesn't throw on 401.

## Fix

Update `handleOdooSync` in `src/pages/Pipeline.tsx` to check for error/disabled responses before showing the success toast:

```typescript
const { data, error } = await supabase.functions.invoke("odoo-crm-sync", { body: { mode: "full" } });
if (error) throw error;

// Handle disabled or error responses that come back as 200
if (data?.disabled) {
  toast({ title: "Odoo Sync Disabled", description: data.error || "Odoo integration is currently disabled.", variant: "destructive" });
  return;
}
if (data?.error) {
  toast({ title: "Odoo Sync Failed", description: data.error, variant: "destructive" });
  return;
}

// Safe display with fallbacks
toast({
  title: "Odoo Sync Complete",
  description: `${data?.created ?? 0} created, ${data?.updated ?? 0} updated, ${data?.reconciled ?? 0} reconciled, ${data?.errors ?? 0} errors (${data?.total ?? 0} total, ${data?.mode ?? "unknown"} mode)`,
});
```

## File Changed

| File | Change |
|------|--------|
| `src/pages/Pipeline.tsx` | Add error/disabled response handling + null-safe fallbacks in toast description |

