

## Plan: Redeploy manage-extract Edge Function

### Problem
The `manage-extract` edge function code was fixed in a previous change (`lengthFactor` → `length_factor: 1` at line 460), but the **deployed version** still runs the old code. The logs confirm the error occurs at runtime despite the source being correct.

### Fix
**Redeploy** the `manage-extract` edge function. No code changes needed — the fix is already in place.

### Steps
1. Deploy `manage-extract` edge function using the deploy tool
2. Verify by checking logs after deployment

